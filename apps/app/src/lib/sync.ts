// Sincronización manual (el colaborador decide cuándo gastar datos):
//   1. sube encuestas pendientes  2. sube fotos y firmas  3. baja formularios
//   4. baja el estado de sus encuestas (revisada, aprobada, rechazada…)

import { claveTitulo, type Esquema, type Ubicacion } from '@geoorigen/motor';
import { supabase, mensajeError } from './supabase.ts';
import { db, esDe, porSubir, type FormularioLocal, type PuntoGPS, type RegistroLocal } from './db.ts';

/** Avisa en pantalla qué se está subiendo */
export type Avance = (texto: string) => void;

export interface ResultadoSync {
  subidas: number;
  fotos: number;
  formularios: number;
  actualizadas: number;
  errores: string[];
}

const ewkt = (lat: number, lon: number) => `SRID=4326;POINT(${lon} ${lat})`;
const punto = (p: PuntoGPS | null) => (p ? ewkt(p.lat, p.lon) : null);

function tituloLocal(r: RegistroLocal, form: FormularioLocal | undefined) {
  const clave = form ? claveTitulo(form.esquema) : '';
  const t = clave ? r.datos[clave] : '';
  return typeof t === 'string' ? t : '';
}

/** Ubicación de la finca: el campo GPS que el formulario marcó como tal */
function geomFinca(r: RegistroLocal, esquema: Esquema | undefined) {
  const v = esquema?.claveUbicacion ? (r.datos[esquema.claveUbicacion] as Ubicacion | undefined) : undefined;
  return v && typeof v === 'object' && 'lat' in v ? ewkt(v.lat, v.lon) : null;
}

async function subirRegistros(orgId: string, userId: string | undefined, res: ResultadoSync, avance: Avance) {
  const pendientes = await db.registros.where({ pendiente: 1 }).filter((r) => r.org_id === orgId && esDe(r, userId) && porSubir(r)).toArray();
  for (const [i, r] of pendientes.entries()) {
    avance(`Subiendo encuesta ${i + 1} de ${pendientes.length}`);
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
    const actualizar = () => supabase.from('registros').update(comun).eq('id', r.id).select('revision').single();
    let { data, error } = r.en_servidor
      ? await actualizar()
      : await supabase.from('registros').insert({
          ...comun,
          id: r.id, org_id: r.org_id, formulario_id: r.formulario_id, creado_en: r.creado_en,
          captura_inicio_geom: punto(r.captura_inicio),
          captura_inicio_precision: r.captura_inicio?.precision ?? null,
          captura_inicio_en: r.captura_inicio?.en ?? null,
          dispositivo: r.dispositivo,
        }).select('revision').single();
    // Ya existía: la subida anterior llegó al servidor pero la respuesta se perdió
    // (señal que se cae). Se actualiza en vez de quedar atascada para siempre.
    let yaEstaba = false;
    if (error?.code === '23505') {
      yaEstaba = true;
      ({ data, error } = await actualizar());
    }
    const nombre = `${form?.nombre ?? 'Encuesta'}${tituloLocal(r, form) ? ` (${tituloLocal(r, form)})` : ''}`;
    if (error && /BLOQUEADA/.test(error.message)) {
      // Ya está en el servidor y no se puede cambiar: o la subida anterior llegó (y la
      // respuesta se perdió), o la revisaron mientras el técnico la editaba sin señal.
      // Manda la del servidor, que se baja al final de la sincronización.
      await db.registros.update(r.id, { en_servidor: true, pendiente: 0, revision: -1 });
      if (yaEstaba) res.subidas++;
      else res.errores.push(`${nombre}: ya estaba en revisión; tus últimos cambios no se aplicaron`);
      continue;
    }
    if (error || !data) {
      res.errores.push(`${nombre}: ${mensajeError(error)}. Sigue guardada en el celular.`);
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

async function subirArchivos(orgId: string, userId: string | undefined, res: ResultadoSync, avance: Avance) {
  const pendientes = await db.archivos.where({ pendiente: 1 }).filter((a) => a.org_id === orgId).toArray();
  for (const [i, a] of pendientes.entries()) {
    const reg = await db.registros.get(a.registro_id);
    if (!reg?.en_servidor || !esDe(reg, userId)) continue;  // primero debe existir la encuesta en el servidor
    // Se suben todas, aunque la encuesta ya no la use (foto quitada, firma reemplazada):
    // en el celular nunca se borra nada que no haya llegado al servidor.
    avance(`Subiendo foto ${i + 1} de ${pendientes.length}`);
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
  // Los formularios desasignados o desactivados se quitan, salvo si en el celular
  // quedan encuestas suyas sin subir (para poder terminarlas y que suban)
  await db.transaction('rw', db.formularios, db.registros, async () => {
    const ids = new Set(locales.map((f) => f.id));
    const conPendientes = new Set((await db.registros.where({ pendiente: 1 }).toArray()).map((r) => r.formulario_id));
    const viejos = await db.formularios.where({ org_id: orgId }).toArray();
    await db.formularios.bulkDelete(viejos.filter((f) => !ids.has(f.id) && !conPendientes.has(f.id)).map((f) => f.id));
    await db.formularios.bulkPut(locales);
  });
  res.formularios = locales.length;
}

async function bajarRegistros(orgId: string, userId: string | undefined, res: ResultadoSync) {
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
      user_id: local?.user_id ?? userId, estado: s.estado, datos: s.datos, creado_en: s.creado_en, actualizado_en: s.actualizado_en,
      captura_inicio: local?.captura_inicio ?? null, captura_fin: local?.captura_fin ?? null,
      ubicacion_simulada: local?.ubicacion_simulada ?? false, dispositivo: local?.dispositivo ?? {},
      en_servidor: true, pendiente: 0, revision: s.revision, sincronizado_en: new Date().toISOString(),
    });
    if (local) res.actualizadas++;
  }
}

export async function sincronizar(orgId: string, userId: string | undefined, avance: Avance = () => {}): Promise<ResultadoSync> {
  const res: ResultadoSync = { subidas: 0, fotos: 0, formularios: 0, actualizadas: 0, errores: [] };
  if (!navigator.onLine) {
    res.errores.push('Sin conexión a internet');
    return res;
  }
  // Cada paso por separado: si uno falla, los demás siguen y nada se borra del celular
  const pasos: [string, () => Promise<void>][] = [
    ['Subir encuestas', () => subirRegistros(orgId, userId, res, avance)],
    ['Subir fotos', () => subirArchivos(orgId, userId, res, avance)],
    ['Bajar formularios', () => { avance('Actualizando formularios'); return bajarFormularios(orgId, res); }],
    ['Bajar encuestas', () => { avance('Revisando estados'); return bajarRegistros(orgId, userId, res); }],
  ];
  for (const [nombre, paso] of pasos) {
    try {
      await paso();
    } catch (e) {
      res.errores.push(`${nombre}: ${mensajeError(e as Error)}`);
    }
  }
  return res;
}
