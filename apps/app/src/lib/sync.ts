// Sincronización manual (el colaborador decide cuándo gastar datos):
//   1. sube encuestas pendientes  2. sube fotos y firmas  3. baja formularios
//   4. baja el estado de sus encuestas (revisada, aprobada, rechazada…)

import type { Esquema, Ubicacion } from '@geoorigen/motor';
import { supabase, mensajeError } from './supabase.ts';
import { db, type FormularioLocal, type PuntoGPS, type RegistroLocal } from './db.ts';

export interface ResultadoSync {
  subidas: number;
  fotos: number;
  formularios: number;
  actualizadas: number;
  errores: string[];
}

const ewkt = (lat: number, lon: number) => `SRID=4326;POINT(${lon} ${lat})`;
const punto = (p: PuntoGPS | null) => (p ? ewkt(p.lat, p.lon) : null);

/** Ubicación de la finca: el campo GPS que el formulario marcó como tal */
function geomFinca(r: RegistroLocal, esquema: Esquema | undefined) {
  const v = esquema?.claveUbicacion ? (r.datos[esquema.claveUbicacion] as Ubicacion | undefined) : undefined;
  return v && typeof v === 'object' && 'lat' in v ? ewkt(v.lat, v.lon) : null;
}

async function subirRegistros(orgId: string, res: ResultadoSync) {
  const pendientes = await db.registros.where({ pendiente: 1 }).filter((r) => r.org_id === orgId).toArray();
  for (const r of pendientes) {
    const form = await db.formularios.get(r.formulario_id);
    const comun = {
      formulario_version: r.formulario_version,
      estado: r.estado,
      datos: r.datos,
      geom: geomFinca(r, form?.esquema),
      actualizado_en: r.actualizado_en,
      captura_fin_geom: punto(r.captura_fin),
      captura_fin_precision: r.captura_fin?.precision ?? null,
      captura_fin_en: r.captura_fin?.en ?? null,
      ubicacion_simulada: r.ubicacion_simulada,
    };
    const { data, error } = r.en_servidor
      ? await supabase.from('registros').update(comun).eq('id', r.id).select('revision').single()
      : await supabase.from('registros').insert({
          ...comun,
          id: r.id, org_id: r.org_id, formulario_id: r.formulario_id, creado_en: r.creado_en,
          captura_inicio_geom: punto(r.captura_inicio),
          captura_inicio_precision: r.captura_inicio?.precision ?? null,
          captura_inicio_en: r.captura_inicio?.en ?? null,
          dispositivo: r.dispositivo,
        }).select('revision').single();
    if (error) {
      res.errores.push(`${form?.nombre ?? 'Encuesta'}: ${mensajeError(error)}`);
      continue;
    }
    // Si el colaborador editó mientras subía, se queda pendiente para la próxima vez
    await db.transaction('rw', db.registros, async () => {
      const actual = await db.registros.get(r.id);
      const sinCambios = actual?.actualizado_en === r.actualizado_en;
      await db.registros.update(r.id, {
        en_servidor: true, revision: data.revision, sincronizado_en: new Date().toISOString(),
        ...(sinCambios ? { pendiente: 0 } : {}),
      });
    });
    res.subidas++;
  }
}

async function subirArchivos(orgId: string, res: ResultadoSync) {
  const pendientes = await db.archivos.where({ pendiente: 1 }).filter((a) => a.org_id === orgId).toArray();
  for (const a of pendientes) {
    const reg = await db.registros.get(a.registro_id);
    if (!reg?.en_servidor) continue;  // primero debe existir la encuesta en el servidor
    // Foto quitada o firma reemplazada: ya no la usa la encuesta, no se sube
    if (!JSON.stringify(reg.datos).includes(a.id)) {
      await db.archivos.delete(a.id);
      continue;
    }
    const ext = a.mime.split('/')[1] === 'jpeg' ? 'jpg' : a.mime.split('/')[1];
    const ruta = `${a.org_id}/${a.registro_id}/${a.id}.${ext}`;
    const { error: e1 } = await supabase.storage.from('campo-archivos').upload(ruta, a.datos, { contentType: a.mime, upsert: false });
    if (e1 && !/exists|Duplicate/i.test(e1.message)) {
      res.errores.push(`Foto: ${mensajeError(e1)}`);
      continue;
    }
    const { error: e2 } = await supabase.from('archivos').insert({
      id: a.id, org_id: a.org_id, registro_id: a.registro_id, campo_key: a.campo_key, tipo: a.tipo,
      origen: a.origen, storage_path: ruta, mime: a.mime, bytes: a.datos.size,
      latitud: a.lat, longitud: a.lon, precision: a.precision, tomada_en: a.tomada_en, exif: a.exif,
    });
    if (e2 && e2.code !== '23505') {  // 23505 = ya estaba registrada
      res.errores.push(`Foto: ${mensajeError(e2)}`);
      continue;
    }
    await db.archivos.update(a.id, { pendiente: 0 });
    res.fotos++;
  }
}

async function bajarFormularios(orgId: string, res: ResultadoSync) {
  const { data: forms, error } = await supabase.from('formularios')
    .select('id, org_id, nombre, descripcion, icono, version_actual, estados')
    .eq('org_id', orgId).eq('activo', true).not('version_actual', 'is', null);
  if (error) { res.errores.push(`Formularios: ${mensajeError(error)}`); return; }
  const lista = forms ?? [];
  const { data: versiones } = lista.length
    ? await supabase.from('formulario_versiones').select('formulario_id, version, schema').in('formulario_id', lista.map((f) => f.id))
    : { data: [] };
  const locales: FormularioLocal[] = [];
  for (const f of lista) {
    const v = (versiones ?? []).find((x) => x.formulario_id === f.id && x.version === f.version_actual);
    if (!v) continue;
    locales.push({
      id: f.id, org_id: f.org_id, nombre: f.nombre, descripcion: f.descripcion ?? '', icono: f.icono ?? '📋',
      version: f.version_actual, esquema: v.schema as Esquema, estados: f.estados ?? [],
    });
  }
  // Los formularios desasignados o desactivados se quitan; sus encuestas guardadas se conservan
  await db.transaction('rw', db.formularios, async () => {
    const ids = new Set(locales.map((f) => f.id));
    const viejos = await db.formularios.where({ org_id: orgId }).toArray();
    await db.formularios.bulkDelete(viejos.filter((f) => !ids.has(f.id)).map((f) => f.id));
    await db.formularios.bulkPut(locales);
  });
  res.formularios = locales.length;
}

async function bajarRegistros(orgId: string, res: ResultadoSync) {
  // Las reglas del servidor solo devuelven las del colaborador y las asignadas a él
  const { data, error } = await supabase.from('registros')
    .select('id, org_id, formulario_id, formulario_version, estado, datos, revision, creado_en, actualizado_en, eliminado')
    .eq('org_id', orgId).order('actualizado_en', { ascending: false }).limit(1000);
  if (error) { res.errores.push(`Encuestas: ${mensajeError(error)}`); return; }
  for (const s of data ?? []) {
    const local = await db.registros.get(s.id);
    if (local?.pendiente) continue;  // los cambios del colaborador mandan
    if (s.eliminado) { if (local) await db.registros.delete(s.id); continue; }
    if (local && local.revision === s.revision) continue;
    await db.registros.put({
      id: s.id, org_id: s.org_id, formulario_id: s.formulario_id, formulario_version: s.formulario_version,
      estado: s.estado, datos: s.datos, creado_en: s.creado_en, actualizado_en: s.actualizado_en,
      captura_inicio: local?.captura_inicio ?? null, captura_fin: local?.captura_fin ?? null,
      ubicacion_simulada: local?.ubicacion_simulada ?? false, dispositivo: local?.dispositivo ?? {},
      en_servidor: true, pendiente: 0, revision: s.revision, sincronizado_en: new Date().toISOString(),
    });
    if (local) res.actualizadas++;
  }
}

export async function sincronizar(orgId: string): Promise<ResultadoSync> {
  const res: ResultadoSync = { subidas: 0, fotos: 0, formularios: 0, actualizadas: 0, errores: [] };
  if (!navigator.onLine) {
    res.errores.push('Sin conexión a internet');
    return res;
  }
  await subirRegistros(orgId, res);
  await subirArchivos(orgId, res);
  await bajarFormularios(orgId, res);
  await bajarRegistros(orgId, res);
  return res;
}
