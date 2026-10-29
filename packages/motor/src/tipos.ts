// Esquema v2 de formularios de GeoOrigen Campo.
// El panel lo edita, la base de datos lo congela por versión y la app lo dibuja.

export type TipoCampo =
  // Básicos
  | 'texto' | 'parrafo' | 'numero' | 'decimal' | 'fecha' | 'hora' | 'sino'
  // Opciones
  | 'select' | 'radio' | 'checkbox' | 'calificacion'
  // Contacto
  | 'email' | 'tel'
  // Especiales
  | 'gps' | 'foto' | 'firma' | 'calculado' | 'repetible' | 'qr'
  // Diseño (no guardan valor)
  | 'separador' | 'instruccion';

export const TIPOS_SIN_VALOR: readonly TipoCampo[] = ['separador', 'instruccion'];
export const TIPOS_CON_OPCIONES: readonly TipoCampo[] = ['select', 'radio', 'checkbox'];

export interface Opcion {
  valor: string;
  etiqueta: string;
}

export type Operador =
  | 'igual' | 'diferente' | 'contiene' | 'no_contiene' | 'empieza_con' | 'termina_con'
  | 'mayor' | 'menor' | 'mayor_igual' | 'menor_igual' | 'vacio' | 'no_vacio';

export interface Regla {
  campo: string;
  operador: Operador;
  valor?: string;
}

export interface Condicion {
  logica: 'y' | 'o';
  reglas: Regla[];
}

export type TipoValidacion =
  | 'min_longitud' | 'max_longitud' | 'min_valor' | 'max_valor' | 'patron' | 'expresion';

export interface Validacion {
  tipo: TipoValidacion;
  valor: string;
  mensaje?: string;
}

export interface Campo {
  key: string;
  etiqueta: string;
  tipo: TipoCampo;
  obligatorio?: boolean;
  ancho?: 'completo' | 'medio';
  placeholder?: string;
  ayuda?: string;
  valorDefecto?: string;
  opciones?: Opcion[];
  condicion?: Condicion | null;
  validaciones?: Validacion[];
  /** Solo 'calculado': expresión, p. ej. REDONDEAR({produccion} / {area}, 1) */
  formula?: string;
  /** Solo 'repetible': campos de cada fila (lotes, miembros del hogar…) */
  campos?: Campo[];
  /** Solo 'repetible': etiqueta de cada fila, p. ej. "Lote" → "Lote 1", "Lote 2" */
  etiquetaFila?: string;
  minFilas?: number;
  maxFilas?: number;
  /** Solo 'foto' */
  maxFotos?: number;
  /**
   * Solo 'foto': permitir elegir de la galería. Por defecto SÍ (a veces la foto
   * se tomó en el lote y se sube después). Las fotos de galería quedan marcadas
   * con su fecha y GPS originales (EXIF) para revisarlas en el panel.
   */
  permitirGaleria?: boolean;
  /** Solo 'calificacion' */
  estrellas?: number;
  /**
   * Qué dato del productor es este campo, para el QR: en la línea base indica qué
   * va dentro del QR; en una visita indica qué se llena solo al escanearlo.
   */
  datoQR?: DatoQR;
  /**
   * Solo 'qr': datos del productor que trae el QR. Se muestran solos debajo del botón,
   * sin poder editarse, y se guardan con la encuesta (ver camposDeQR).
   */
  traeQR?: DatoQR[];
}

export type DatoQR = 'cedula' | 'nombre' | 'finca' | 'vereda' | 'municipio' | 'telefono' | 'ubicacion';

export const DATOS_QR: { dato: DatoQR; etiqueta: string }[] = [
  { dato: 'cedula', etiqueta: 'Cédula / documento' },
  { dato: 'nombre', etiqueta: 'Nombre del productor' },
  { dato: 'finca', etiqueta: 'Nombre de la finca' },
  { dato: 'vereda', etiqueta: 'Vereda' },
  { dato: 'municipio', etiqueta: 'Municipio' },
  { dato: 'telefono', etiqueta: 'Teléfono' },
  { dato: 'ubicacion', etiqueta: 'Ubicación de la finca (GPS)' },
];

export interface Seccion {
  id: string;
  titulo: string;
  descripcion?: string;
  condicion?: Condicion | null;
  campos: Campo[];
}

export interface Esquema {
  version: 2;
  /** Campo que se muestra como título del registro en las listas */
  claveNombre: string;
  claveSubtitulo?: string;
  /** Campo 'gps' que representa la ubicación de la finca (se compara con el GPS de captura) */
  claveUbicacion?: string;
  secciones: Seccion[];
}

// ── Valores capturados ────────────────────────────────────────────────────────

export interface Ubicacion {
  lat: number;
  lon: number;
  /** Precisión en metros reportada por el GPS */
  precision?: number;
  /** Hora del GPS (ISO) */
  en?: string;
}

export type Fila = { [key: string]: Valor };

/**
 * texto/número/fecha/select… → string
 * checkbox, foto (ids de archivo) → string[]
 * gps → Ubicacion
 * repetible → Fila[]
 */
export type Valor = string | string[] | Ubicacion | Fila[] | null;

export type Valores = { [key: string]: Valor };

/** Campo que da el título del registro: el elegido en el editor o, si no se eligió,
 *  el primer campo de texto del formulario (para no mostrar "Sin título"). */
export function claveTitulo(esquema: Esquema): string {
  if (esquema.claveNombre) return esquema.claveNombre;
  const campos = esquema.secciones.flatMap((s) => s.campos);
  // Una visita con QR: el nombre del productor que trae el QR
  const qr = campos.find((c) => c.tipo === 'qr' && c.traeQR?.includes('nombre'));
  if (qr) return claveDatoQR(qr.key, 'nombre');
  return campos.find((c) => c.tipo === 'texto')?.key ?? '';
}

/** Clave donde se guarda un dato que trajo el QR: "qr_productor" + "cedula" → "qr_productor_cedula" */
export const claveDatoQR = (campoQR: string, dato: DatoQR) => `${campoQR}_${dato}`;

/** Campos (de solo lectura) con los datos que trae un campo 'qr' */
export function camposDeQR(campo: Campo): Campo[] {
  if (campo.tipo !== 'qr') return [];
  return (campo.traeQR ?? []).map((dato) => ({
    key: claveDatoQR(campo.key, dato),
    etiqueta: DATOS_QR.find((d) => d.dato === dato)?.etiqueta ?? dato,
    tipo: dato === 'ubicacion' ? 'gps' : 'texto',
  }));
}

/** Los campos de una lista con los datos del QR a continuación de cada campo 'qr' */
export const conCamposDeQR = (campos: Campo[]): Campo[] => campos.flatMap((c) => [c, ...camposDeQR(c)]);

/** Campo GPS con la ubicación de la finca: el elegido en el editor o el que trajo un QR */
export function claveUbicacionFinca(esquema: Esquema): string {
  if (esquema.claveUbicacion) return esquema.claveUbicacion;
  const qr = esquema.secciones.flatMap((s) => s.campos).find((c) => c.tipo === 'qr' && c.traeQR?.includes('ubicacion'));
  return qr ? claveDatoQR(qr.key, 'ubicacion') : '';
}
