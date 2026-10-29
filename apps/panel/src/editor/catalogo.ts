// Catálogo de tipos de campo para el editor y constructores de piezas vacías.

import type { Campo, Esquema, Operador, Seccion, TipoCampo, TipoValidacion } from '@geoorigen/motor';

export interface MetaTipo {
  tipo: TipoCampo;
  etiqueta: string;
  icono: string;
  grupo: 'Básicos' | 'Opciones' | 'Contacto' | 'Especiales' | 'Diseño';
}

export const TIPOS: MetaTipo[] = [
  { tipo: 'texto', etiqueta: 'Texto corto', icono: 'T', grupo: 'Básicos' },
  { tipo: 'parrafo', etiqueta: 'Párrafo', icono: '¶', grupo: 'Básicos' },
  { tipo: 'numero', etiqueta: 'Número entero', icono: '123', grupo: 'Básicos' },
  { tipo: 'decimal', etiqueta: 'Número decimal', icono: '1.5', grupo: 'Básicos' },
  { tipo: 'fecha', etiqueta: 'Fecha', icono: '📅', grupo: 'Básicos' },
  { tipo: 'hora', etiqueta: 'Hora', icono: '⏰', grupo: 'Básicos' },
  { tipo: 'sino', etiqueta: 'Sí / No', icono: '✓', grupo: 'Básicos' },
  { tipo: 'select', etiqueta: 'Lista desplegable', icono: '▼', grupo: 'Opciones' },
  { tipo: 'radio', etiqueta: 'Opción única', icono: '◉', grupo: 'Opciones' },
  { tipo: 'checkbox', etiqueta: 'Casillas (varias)', icono: '☑', grupo: 'Opciones' },
  { tipo: 'calificacion', etiqueta: 'Calificación ★', icono: '★', grupo: 'Opciones' },
  { tipo: 'email', etiqueta: 'Correo', icono: '@', grupo: 'Contacto' },
  { tipo: 'tel', etiqueta: 'Teléfono', icono: '📞', grupo: 'Contacto' },
  { tipo: 'gps', etiqueta: 'Ubicación GPS', icono: '📍', grupo: 'Especiales' },
  { tipo: 'foto', etiqueta: 'Fotografías', icono: '📷', grupo: 'Especiales' },
  { tipo: 'firma', etiqueta: 'Firma', icono: '✍', grupo: 'Especiales' },
  { tipo: 'calculado', etiqueta: 'Campo calculado', icono: '=', grupo: 'Especiales' },
  { tipo: 'repetible', etiqueta: 'Grupo repetible', icono: '⧉', grupo: 'Especiales' },
  { tipo: 'qr', etiqueta: 'Escanear QR del productor', icono: '▣', grupo: 'Especiales' },
  { tipo: 'separador', etiqueta: 'Título / separador', icono: '—', grupo: 'Diseño' },
  { tipo: 'instruccion', etiqueta: 'Instrucción', icono: 'ℹ', grupo: 'Diseño' },
];

export const GRUPOS = ['Básicos', 'Opciones', 'Contacto', 'Especiales', 'Diseño'] as const;

export const metaTipo = (t: TipoCampo) => TIPOS.find((m) => m.tipo === t);

export const OPERADORES: { op: Operador; etiqueta: string; sinValor?: boolean }[] = [
  { op: 'igual', etiqueta: 'es igual a' },
  { op: 'diferente', etiqueta: 'es diferente de' },
  { op: 'contiene', etiqueta: 'contiene' },
  { op: 'no_contiene', etiqueta: 'no contiene' },
  { op: 'empieza_con', etiqueta: 'empieza con' },
  { op: 'termina_con', etiqueta: 'termina con' },
  { op: 'mayor', etiqueta: 'es mayor que' },
  { op: 'menor', etiqueta: 'es menor que' },
  { op: 'mayor_igual', etiqueta: 'mayor o igual a' },
  { op: 'menor_igual', etiqueta: 'menor o igual a' },
  { op: 'vacio', etiqueta: 'está vacío', sinValor: true },
  { op: 'no_vacio', etiqueta: 'no está vacío', sinValor: true },
];

export const VALIDACIONES: { tipo: TipoValidacion; etiqueta: string; para: TipoCampo[]; ejemplo: string }[] = [
  { tipo: 'min_longitud', etiqueta: 'Longitud mínima', para: ['texto', 'parrafo', 'email', 'tel'], ejemplo: '3' },
  { tipo: 'max_longitud', etiqueta: 'Longitud máxima', para: ['texto', 'parrafo', 'email', 'tel'], ejemplo: '100' },
  { tipo: 'min_valor', etiqueta: 'Valor mínimo', para: ['numero', 'decimal', 'calificacion'], ejemplo: '0' },
  { tipo: 'max_valor', etiqueta: 'Valor máximo', para: ['numero', 'decimal', 'calificacion'], ejemplo: '100' },
  { tipo: 'patron', etiqueta: 'Patrón (expresión regular)', para: ['texto', 'tel'], ejemplo: '^[0-9]{6,10}$' },
  { tipo: 'expresion', etiqueta: 'Regla con fórmula', para: ['texto', 'parrafo', 'numero', 'decimal', 'fecha'], ejemplo: '{edad} >= 18' },
];

/** Convierte una etiqueta en una clave: "Área en café (ha)" → "area_en_cafe_ha" */
export function aClave(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'campo';
}

export function claveUnica(base: string, usadas: Set<string>): string {
  let clave = base;
  for (let n = 2; usadas.has(clave); n++) clave = `${base}_${n}`;
  return clave;
}

/** Todas las claves de un esquema (incluidas las de filas de repetibles) */
export function clavesUsadas(esquema: Esquema): Set<string> {
  const s = new Set<string>();
  const recorrer = (campos: Campo[]) => campos.forEach((c) => { s.add(c.key); recorrer(c.campos ?? []); });
  esquema.secciones.forEach((sec) => recorrer(sec.campos));
  return s;
}

export function campoNuevo(tipo: TipoCampo, usadas: Set<string>): Campo {
  const meta = metaTipo(tipo);
  const etiqueta = meta?.etiqueta ?? 'Nuevo campo';
  const campo: Campo = { key: claveUnica(aClave(etiqueta), usadas), etiqueta, tipo, ancho: 'completo' };
  if (tipo === 'select' || tipo === 'radio' || tipo === 'checkbox') {
    campo.opciones = [{ valor: 'opcion_1', etiqueta: 'Opción 1' }, { valor: 'opcion_2', etiqueta: 'Opción 2' }];
  }
  if (tipo === 'repetible') {
    campo.etiqueta = 'Lotes';
    campo.key = claveUnica('lotes', usadas);
    campo.etiquetaFila = 'Lote';
    campo.campos = [];
    campo.minFilas = 1;
  }
  if (tipo === 'foto') { campo.maxFotos = 5; campo.permitirGaleria = true; }
  if (tipo === 'calificacion') campo.estrellas = 5;
  if (tipo === 'calculado') campo.formula = '';
  if (tipo === 'qr') {
    campo.etiqueta = 'Productor (escanear QR)';
    campo.key = claveUnica('qr_productor', usadas);
    campo.traeQR = ['cedula', 'nombre', 'finca', 'ubicacion'];
  }
  return campo;
}

export function seccionNueva(n: number): Seccion {
  return { id: `sec_${Date.now().toString(36)}`, titulo: `Sección ${n}`, campos: [] };
}

export function esquemaVacio(): Esquema {
  return { version: 2, claveNombre: '', claveSubtitulo: '', secciones: [seccionNueva(1)] };
}
