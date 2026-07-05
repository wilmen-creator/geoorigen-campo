// Sistema genérico de formularios por esquema — usado por Cacao y futuros
// registros, sin tocar el código específico de Café (que ya funciona).
// ── Formularios Dinámicos (descargados desde Supabase) ──────────────────────

export interface OpcionCampo { valor: string; etiqueta: string; }

export interface ReglaCondicion {
  campo: string;
  operador: string;
  valor: string;
}

export interface CondicionDinamica {
  logica: 'y' | 'o';
  reglas: ReglaCondicion[];
}

export interface ValidacionCampo {
  tipo: string;
  valor: string;
  mensaje: string;
}

export interface CampoDinamico {
  key: string;
  etiqueta: string;
  tipo: string;
  obligatorio?: boolean;
  ancho?: 'completo' | 'medio';
  placeholder?: string;
  ayuda?: string;
  opciones?: OpcionCampo[];
  condicion?: CondicionDinamica | null;
  validaciones?: ValidacionCampo[];
  formula?: string;
  config?: Record<string, unknown>;
  valorDefecto?: string;
}

export interface SeccionDinamica {
  id: string;
  titulo: string;
  descripcion?: string;
  condicion?: CondicionDinamica | null;
  conGPS?: boolean;
  campos: CampoDinamico[];
}

export interface SchemaDinamico {
  claveNombre: string;
  claveSubtitulo?: string;
  secciones: SeccionDinamica[];
}

export interface FormularioDinamico {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  activo: boolean;
  version: number;
  schema: SchemaDinamico;
  updated_at: string;
}

// ── Evaluador de condiciones dinámicas ────────────────────────────────────

export function evaluarCondicionDinamica(
  condicion: CondicionDinamica | null | undefined,
  valores: Record<string, string>,
): boolean {
  if (!condicion || condicion.reglas.length === 0) return true;
  const resultados = condicion.reglas.map((r) => evalRegla(r, valores));
  return condicion.logica === 'o' ? resultados.some(Boolean) : resultados.every(Boolean);
}

function evalRegla(r: ReglaCondicion, valores: Record<string, string>): boolean {
  const val = String(valores[r.campo] ?? '').trim();
  const obj = String(r.valor ?? '').trim();
  switch (r.operador) {
    case 'igual':       return val === obj;
    case 'diferente':   return val !== obj;
    case 'contiene':    return val.toLowerCase().includes(obj.toLowerCase());
    case 'no_contiene': return !val.toLowerCase().includes(obj.toLowerCase());
    case 'empieza_con': return val.toLowerCase().startsWith(obj.toLowerCase());
    case 'termina_con': return val.toLowerCase().endsWith(obj.toLowerCase());
    case 'mayor':       return Number(val) > Number(obj);
    case 'menor':       return Number(val) < Number(obj);
    case 'mayor_igual': return Number(val) >= Number(obj);
    case 'menor_igual': return Number(val) <= Number(obj);
    case 'vacio':       return val === '';
    case 'no_vacio':    return val !== '';
    default:            return true;
  }
}

// ── Evaluador de fórmulas ─────────────────────────────────────────────────

export function evaluarFormulaDinamica(formula: string, valores: Record<string, string>): string {
  if (!formula || !formula.trim()) return '';
  try {
    let expr = formula.replace(/\{(\w+)\}/g, (_, key: string) => {
      const v = valores[key] ?? '';
      const n = Number(v);
      return isNaN(n) ? JSON.stringify(String(v)) : String(n);
    });
    expr = expr
      .replace(/SUMA\(([^)]+)\)/gi, (_, a: string) => `(${a.split(',').map((s: string) => s.trim()).join('+')})`)
      .replace(/PROMEDIO\(([^)]+)\)/gi, (_, a: string) => { const p = a.split(','); return `((${p.join('+')})*1/${p.length})`; })
      .replace(/REDONDEAR\(([^,]+),\s*(\d+)\)/gi, (_, n: string, d: string) => `(Math.round((${n})*Math.pow(10,${d}))/Math.pow(10,${d}))`)
      .replace(/ENTERO\(([^)]+)\)/gi, (_, n: string) => `Math.trunc(${n})`)
      .replace(/ABS\(([^)]+)\)/gi, (_, n: string) => `Math.abs(${n})`)
      .replace(/MAX\(([^)]+)\)/gi, (_, a: string) => `Math.max(${a})`)
      .replace(/MIN\(([^)]+)\)/gi, (_, a: string) => `Math.min(${a})`)
      .replace(/TEXTO\(([^,]+),\s*(\d+)\)/gi, (_, n: string, d: string) => `Number(${n}).toFixed(${d})`)
      .replace(/CONCATENAR\(([^)]+)\)/gi, (_, a: string) => `[${a}].join('')`)
      .replace(/SI\(([^,]+),([^,]+),([^)]+)\)/gi, (_, c: string, s: string, n: string) => `((${c})?${s}:${n})`);
    // eslint-disable-next-line no-new-func
    const resultado = new Function('Math', `"use strict"; return (${expr})`)(Math);
    if (resultado === null || resultado === undefined || resultado === '') return '';
    if (typeof resultado === 'number') {
      if (!isFinite(resultado)) return '';
      return Number.isInteger(resultado) ? String(resultado) : parseFloat(resultado.toFixed(6)).toString();
    }
    return String(resultado);
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export type TipoCampo =
  | 'texto' | 'numero' | 'select' | 'sino'
  | 'fecha' | 'textarea' | 'email' | 'tel' | 'calculado';

export interface CondicionCampo {
  key: string;
  valor: string;
}

export interface CampoSchema {
  key: string;
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: string[];
  ancho?: 'completo' | 'medio';
  obligatorio?: boolean;
  // Solo para tipo 'calculado': deriva el valor a partir de otras respuestas
  calcular?: (datos: Record<string, string>) => string;
  // Si se define, el campo solo se muestra cuando TODAS estas condiciones
  // se cumplen (ej: mostrar solo si 'pertenece_asociacion' === 'Si')
  dependeDe?: CondicionCampo[];
}

export function campoVisible(campo: CampoSchema, datos: Record<string, string>): boolean {
  if (!campo.dependeDe || campo.dependeDe.length === 0) return true;
  return campo.dependeDe.every((c) => datos[c.key] === c.valor);
}

export interface SeccionSchema {
  titulo: string;
  campos: CampoSchema[];
  // true en la sección donde debe aparecer el botón de captura GPS
  conGPS?: boolean;
}

export interface EsquemaRegistro {
  tipo: string; // identificador único, ej. 'cacao'
  nombre: string; // nombre visible, ej. 'Línea Base Cacao'
  icono: string;
  secciones: SeccionSchema[];
  // claves usadas para mostrar la tarjeta en la lista (nombre / subtítulo)
  claveNombre: string;
  claveSubtitulo: string;
}

export interface RegistroGenerico {
  id: string;
  tipo: string;
  creado_en: string;
  actualizado_en: string;
  sincronizado: boolean;
  sincronizado_en?: string;
  datos: Record<string, string>;
}

export function registroVacio(tipo: string): RegistroGenerico {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    tipo,
    creado_en: now,
    actualizado_en: now,
    sincronizado: false,
    datos: {},
  };
}
