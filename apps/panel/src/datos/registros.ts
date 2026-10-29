// Consulta de registros para la pantalla Datos y conversión de respuestas a texto.

import { claveTitulo, evaluarRegla, type Campo, type Esquema, type Regla, type Ubicacion, type Valor, type Valores } from '@geoorigen/motor';
import { supabase } from '../lib/supabase.ts';

export interface RegistroPanel {
  id: string;
  formulario_id: string;
  formulario_version: number;
  estado: string;
  datos: Valores;
  creado_por: string;
  creado_en: string;
  actualizado_en: string;
  recibido_en: string;
  revision: number;
  captura_lat: number | null;
  captura_lon: number | null;
  captura_inicio_precision: number | null;
  captura_inicio_en: string | null;
  captura_fin_lat: number | null;
  captura_fin_lon: number | null;
  captura_fin_precision: number | null;
  captura_fin_en: string | null;
  ubicacion_simulada: boolean;
  dispositivo: Record<string, unknown>;
  finca_lat: number | null;
  finca_lon: number | null;
  distancia_finca_m: number | null;
  duracion_s: number | null;
  alertas: string[];
  tecnico_nombre: string | null;
  tecnico_email: string | null;
}

export interface Filtros {
  tecnico: string;
  estado: string;
  desde: string;
  hasta: string;
  buscar: string;
  /** '' = todas, 'cualquiera' = con alguna alerta, o el nombre de una alerta */
  alerta: string;
  /** Filtros por pregunta del formulario, como en Fulcrum */
  reglas: Regla[];
}

export const FILTROS_VACIOS: Filtros = { tecnico: '', estado: '', desde: '', hasta: '', buscar: '', alerta: '', reglas: [] };

export const ALERTAS: Record<string, { texto: string; detalle: string }> = {
  lejos_finca: { texto: 'Lejos de la finca', detalle: 'La encuesta se hizo lejos de la ubicación declarada de la finca' },
  gps_impreciso: { texto: 'GPS impreciso', detalle: 'El GPS reportó más de 50 m de error' },
  sin_gps: { texto: 'Sin GPS', detalle: 'No se pudo tomar la ubicación al abrir la encuesta' },
  ubicacion_simulada: { texto: 'Ubicación simulada', detalle: 'El celular tenía una app de GPS falso activa' },
  llenado_rapido: { texto: 'Llenado rápido', detalle: 'Se llenó en menos del tiempo mínimo configurado' },
  mismo_punto: { texto: 'Mismo punto', detalle: 'Otra finca distinta se encuestó desde el mismo lugar' },
};

export const LIMITE = 5000;

/** Minúsculas y sin tildes, igual que el texto de búsqueda que arma la base de datos */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export async function consultarRegistros(orgId: string, formularioId: string, f: Filtros) {
  let q = supabase.from('registros_panel').select('*')
    .eq('org_id', orgId).eq('formulario_id', formularioId).eq('eliminado', false);
  if (f.tecnico) q = q.eq('creado_por', f.tecnico);
  if (f.estado) q = q.eq('estado', f.estado);
  if (f.desde) q = q.gte('creado_en', `${f.desde}T00:00:00`);
  if (f.hasta) q = q.lte('creado_en', `${f.hasta}T23:59:59.999`);
  if (f.buscar.trim()) {
    // Cada palabra debe aparecer en algún lado del registro
    for (const palabra of normalizar(f.buscar).split(/\s+/)) {
      q = q.ilike('texto_busqueda', `%${palabra.replace(/[%_]/g, '')}%`);
    }
  }
  if (f.alerta === 'cualquiera') q = q.neq('alertas', '{}');
  else if (f.alerta) q = q.contains('alertas', [f.alerta]);

  const { data, error } = await q.order('creado_en', { ascending: false }).limit(LIMITE);
  if (error) throw error;
  let filas = (data ?? []) as RegistroPanel[];
  // Las reglas por pregunta se evalúan con el mismo motor de la app
  const reglas = f.reglas.filter((r) => r.campo);
  if (reglas.length) filas = filas.filter((r) => reglas.every((regla) => evaluarRegla(regla, [r.datos])));
  return { filas, recortado: (data ?? []).length >= LIMITE };
}

// ── Respuestas como texto legible ─────────────────────────────────────────────

function etiquetaOpcion(campo: Campo, valor: string) {
  return campo.opciones?.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

export function valorComoTexto(campo: Campo, v: Valor | undefined): string {
  if (v === undefined || v === null || v === '') return '';
  switch (campo.tipo) {
    case 'select': case 'radio':
      return etiquetaOpcion(campo, String(v));
    case 'checkbox':
      return Array.isArray(v) ? (v as string[]).map((x) => etiquetaOpcion(campo, x)).join('; ') : String(v);
    case 'sino':
      return v === 'Si' ? 'Sí' : String(v);
    case 'gps': {
      const u = v as Ubicacion;
      return typeof u === 'object' && 'lat' in u ? `${u.lat.toFixed(6)}, ${u.lon.toFixed(6)}` : String(v);
    }
    case 'foto':
      return Array.isArray(v) ? `${v.length} foto(s)` : '';
    case 'firma':
      return v ? 'Firmado' : '';
    case 'repetible':
      return Array.isArray(v) ? `${v.length} fila(s)` : '';
    default:
      return typeof v === 'string' ? v : JSON.stringify(v);
  }
}

/** Campos de primer nivel que guardan respuesta */
export function camposConValor(esquema: Esquema): Campo[] {
  return esquema.secciones.flatMap((s) => s.campos).filter((c) => !['separador', 'instruccion'].includes(c.tipo));
}

/** Título y subtítulo de un registro según el esquema */
export function tituloRegistro(r: RegistroPanel, esquema: Esquema | null) {
  const clave = esquema ? claveTitulo(esquema) : '';
  const t = clave ? r.datos[clave] : '';
  const s = esquema?.claveSubtitulo ? r.datos[esquema.claveSubtitulo] : '';
  return {
    titulo: typeof t === 'string' && t ? t : 'Sin título',
    subtitulo: typeof s === 'string' ? s : '',
  };
}
