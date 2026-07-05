import { getSupabase } from './supabase';
import { db, guardarEncuesta, guardarRegistro, guardarFormulario } from './db';
import type { Encuesta } from './types';
import type { RegistroGenerico, FormularioDinamico } from './generico/tipos';

export interface ResultadoSync {
  ok: boolean;
  subidas: number;
  errores: number;
  mensaje: string;
}

function aFilaSupabase(e: Encuesta) {
  // 'lotes' se guarda como JSONB; el resto son columnas planas
  return {
    id: e.id,
    tipo_dni: e.tipo_dni, dni: e.dni, nombre: e.nombre, telefono: e.telefono,
    direccion: e.direccion, escolaridad: e.escolaridad, fecha_nac: e.fecha_nac || null,
    sexo: e.sexo, estado_civil: e.estado_civil,

    finca: e.finca, depto: e.depto, municipio: e.municipio,
    altitud_msnm: numOrNull(e.altitud_msnm), latitud: numOrNull(e.latitud), longitud: numOrNull(e.longitud),
    area_total_ha: numOrNull(e.area_total_ha), area_cafe_ha: numOrNull(e.area_cafe_ha),
    area_prod_ha: numOrNull(e.area_prod_ha), area_levante_ha: numOrNull(e.area_levante_ha),
    area_bosque_ha: numOrNull(e.area_bosque_ha), otros_cultivos_ha: numOrNull(e.otros_cultivos_ha),
    pastos_ha: numOrNull(e.pastos_ha), renovacion_ha: numOrNull(e.renovacion_ha),
    produccion_anual: numOrNull(e.produccion_anual), unidad_prod: e.unidad_prod,
    fuente_agua: e.fuente_agua, trat_mieles_sn: e.trat_mieles_sn, tipo_tratamiento: e.tipo_tratamiento,
    fosa_pulpa: e.fosa_pulpa, analisis_suelos: e.analisis_suelos, ano_analisis: numOrNull(e.ano_analisis),
    acceso_vial: e.acceso_vial,

    beneficiadero: e.beneficiadero, despulpadora: e.despulpadora, fermentacion: e.fermentacion,
    secado: e.secado, bodega: e.bodega, energia: e.energia, internet: e.internet,
    red_celular: e.red_celular, operador: e.operador,

    lotes: e.lotes,

    cosecha_ppal: e.cosecha_ppal, mitaca: e.mitaca, meses_detalle: e.meses_detalle,
    ferm_horas: numOrNull(e.ferm_horas), lavado: e.lavado, proc_especiales: e.proc_especiales,
    tipo_proceso: e.tipo_proceso, cual_proceso: e.cual_proceso, obs_cosecha: e.obs_cosecha,

    certificaciones: e.certificaciones, tipo_certif: e.tipo_certif, cual_certif: e.cual_certif,
    concursos: e.concursos, nombre_concurso: e.nombre_concurso, conoce_puntaje: e.conoce_puntaje,
    puntaje_taza: numOrNull(e.puntaje_taza), primas: e.primas, comprador: e.comprador,
    precio_cop: numOrNull(e.precio_cop), obs_calidad: e.obs_calidad,

    creado_en: e.creado_en,
    actualizado_en: e.actualizado_en,
  };
}

function numOrNull(v: string) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export async function sincronizar(): Promise<ResultadoSync> {
  const supabase = await getSupabase();
  if (!supabase) {
    return { ok: false, subidas: 0, errores: 0, mensaje: 'Falta configurar la conexión a Supabase (ver Ajustes).' };
  }
  if (!navigator.onLine) {
    return { ok: false, subidas: 0, errores: 0, mensaje: 'Sin conexión a internet en este momento.' };
  }

  const pendientes = await db.encuestas.filter((e) => !e.sincronizado).toArray();
  if (pendientes.length === 0) {
    return { ok: true, subidas: 0, errores: 0, mensaje: 'No hay encuestas pendientes por subir.' };
  }

  let subidas = 0;
  let errores = 0;

  for (const encuesta of pendientes) {
    const fila = aFilaSupabase(encuesta);
    const { error } = await supabase.from('encuestas_linea_base').upsert(fila, { onConflict: 'id' });
    if (error) {
      errores++;
      console.error('Error sincronizando encuesta', encuesta.id, error.message);
    } else {
      subidas++;
      await guardarEncuesta({ ...encuesta, sincronizado: true, sincronizado_en: new Date().toISOString() });
    }
  }

  const ok = errores === 0;
  const mensaje = ok
    ? `${subidas} encuesta(s) subida(s) correctamente.`
    : `${subidas} subida(s), ${errores} con error. Revisa la conexión e intenta de nuevo.`;

  return { ok, subidas, errores, mensaje };
}

// ---------- Sincronización de registros genéricos (cacao y futuros) ----------
// Se guardan en una sola tabla 'registros_campo' con los datos como JSONB,
// para no tener que crear una tabla nueva por cada cultivo/esquema.

export async function sincronizarGenerico(tipo: string): Promise<ResultadoSync> {
  const supabase = await getSupabase();
  if (!supabase) {
    return { ok: false, subidas: 0, errores: 0, mensaje: 'Falta configurar la conexión a Supabase (ver Ajustes).' };
  }
  if (!navigator.onLine) {
    return { ok: false, subidas: 0, errores: 0, mensaje: 'Sin conexión a internet en este momento.' };
  }

  const pendientes = (await db.registros.where('tipo').equals(tipo).toArray())
    .filter((r) => !r.sincronizado);

  if (pendientes.length === 0) {
    return { ok: true, subidas: 0, errores: 0, mensaje: 'No hay registros pendientes por subir.' };
  }

  let subidas = 0;
  let errores = 0;

  for (const registro of pendientes as RegistroGenerico[]) {
    const fila = {
      id: registro.id,
      tipo: registro.tipo,
      datos: registro.datos,
      creado_en: registro.creado_en,
      actualizado_en: registro.actualizado_en,
    };
    const { error } = await supabase.from('registros_campo').upsert(fila, { onConflict: 'id' });
    if (error) {
      errores++;
      console.error('Error sincronizando registro', registro.id, error.message);
    } else {
      subidas++;
      await guardarRegistro({ ...registro, sincronizado: true, sincronizado_en: new Date().toISOString() });
    }
  }

  const ok = errores === 0;
  const mensaje = ok
    ? `${subidas} registro(s) subido(s) correctamente.`
    : `${subidas} subida(s), ${errores} con error. Revisa la conexión e intenta de nuevo.`;

  return { ok, subidas, errores, mensaje };
}

// ---------- Descarga de perfil del colaborador (acceso a módulos) ----------

export interface PerfilColaborador {
  acceso_cafe: boolean;
  acceso_cacao: boolean;
}

export async function sincronizarPerfil(): Promise<PerfilColaborador | null> {
  const supabase = await getSupabase();
  if (!supabase || !navigator.onLine) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('colaboradores_campo')
    .select('acceso_cafe, acceso_cacao')
    .eq('user_id', user.id)
    .maybeSingle();
  // Si no hay fila (es admin), null → acceso total
  return data ? { acceso_cafe: data.acceso_cafe, acceso_cacao: data.acceso_cacao } : null;
}

// ---------- Descarga de formularios dinámicos desde Supabase ----------
// Solo descarga, nunca sube (los schemas se crean desde el admin web).

export async function sincronizarFormularios(): Promise<ResultadoSync> {
  const supabase = await getSupabase();
  if (!supabase) {
    return { ok: false, subidas: 0, errores: 0, mensaje: 'Falta configurar la conexión a Supabase (ver Ajustes).' };
  }
  if (!navigator.onLine) {
    return { ok: false, subidas: 0, errores: 0, mensaje: 'Sin conexión a internet en este momento.' };
  }

  const { data, error } = await supabase
    .from('formularios')
    .select('id, nombre, descripcion, icono, activo, version, schema, tipo_sistema, updated_at')
    .eq('activo', true);

  if (error) {
    return { ok: false, subidas: 0, errores: 1, mensaje: `Error al descargar formularios: ${error.message}` };
  }

  // Borrar todos los formularios locales y reemplazar con los del servidor
  // (así los desasignados desaparecen al sincronizar)
  await db.formularios.clear();
  let descargados = 0;
  for (const form of (data || []) as FormularioDinamico[]) {
    await guardarFormulario(form);
    descargados++;
  }

  return {
    ok: true, subidas: descargados, errores: 0,
    mensaje: `${descargados} formulario(s) actualizados.`,
  };
}

// ---------- Subida de respuestas de formularios dinámicos ----------
// Usa la misma tabla registros_campo que cacao, con tipo = formulario.id

export async function sincronizarFormularioDinamico(tipo: string): Promise<ResultadoSync> {
  return sincronizarGenerico(tipo);
}
