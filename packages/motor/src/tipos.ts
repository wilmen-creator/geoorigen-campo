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
  | 'gps' | 'foto' | 'firma' | 'calculado' | 'repetible'
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
}

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
