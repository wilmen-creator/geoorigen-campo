// Intérprete de fórmulas de los campos calculados y de las validaciones.
// No usa eval ni new Function: solo entiende números, textos, referencias
// {campo}, operadores y las funciones de la lista. Nada más se puede ejecutar.
//
// Ejemplos:
//   REDONDEAR({produccion_anual} / {area_cacao}, 1)
//   SI({area_cacao} > 0, {produccion_anual} / {area_cacao}, "")
//   SUMA({lotes.area_cafe})            ← suma una columna de un grupo repetible
//   EDAD({fecha_nac})

import type { Valores, Valor, Fila, Ubicacion } from './tipos.ts';

/** Ámbitos de búsqueda: el último es el más interno (la fila de un repetible). */
export type Contexto = Valores[];

type Dato = number | string | boolean | null | Dato[];

// ── Tokenizador ───────────────────────────────────────────────────────────────

type Token =
  | { t: 'num'; v: number }
  | { t: 'txt'; v: string }
  | { t: 'ref'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string };

const OPERADORES = ['===', '!==', '==', '!=', '<>', '<=', '>=', '&&', '||', '+', '-', '*', '/', '%', '&', '=', '<', '>', '!', '(', ')', ',', '?', ':'];

function tokenizar(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?|^[0-9]+\.?/.exec(src.slice(i));
      if (!m) throw new Error('Número inválido');
      tokens.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (c === '"' || c === "'") {
      const fin = src.indexOf(c, i + 1);
      if (fin < 0) throw new Error('Texto sin cerrar');
      tokens.push({ t: 'txt', v: src.slice(i + 1, fin) });
      i = fin + 1;
      continue;
    }
    if (c === '{') {
      const fin = src.indexOf('}', i);
      if (fin < 0) throw new Error('Referencia sin cerrar');
      const ref = src.slice(i + 1, fin).trim();
      if (!/^[\w]+(\.[\w]+)?$/.test(ref)) throw new Error(`Referencia inválida: ${ref}`);
      tokens.push({ t: 'ref', v: ref });
      i = fin + 1;
      continue;
    }
    if (/[A-Za-zÁÉÍÓÚÑáéíóúñ_]/.test(c)) {
      const m = /^[A-Za-zÁÉÍÓÚÑáéíóúñ_][\wÁÉÍÓÚÑáéíóúñ]*/.exec(src.slice(i))!;
      tokens.push({ t: 'id', v: m[0].toUpperCase() });
      i += m[0].length;
      continue;
    }
    const op = OPERADORES.find((o) => src.startsWith(o, i));
    if (!op) throw new Error(`Carácter no permitido: ${c}`);
    tokens.push({ t: 'op', v: op });
    i += op.length;
  }
  return tokens;
}

// ── Árbol de la expresión ─────────────────────────────────────────────────────

type Nodo =
  | { k: 'lit'; v: Dato }
  | { k: 'ref'; v: string }
  | { k: 'fn'; nombre: string; args: Nodo[] }
  | { k: 'un'; op: string; a: Nodo }
  | { k: 'bin'; op: string; a: Nodo; b: Nodo }
  | { k: 'si'; c: Nodo; a: Nodo; b: Nodo };

// Precedencia de menor a mayor
const NIVELES: string[][] = [
  ['||'],
  ['&&'],
  ['=', '==', '===', '!=', '!==', '<>'],
  ['<', '>', '<=', '>='],
  ['&'],
  ['+', '-'],
  ['*', '/', '%'],
];

function analizar(tokens: Token[]): Nodo {
  let pos = 0;
  const ver = () => tokens[pos];
  const esOp = (v: string) => ver()?.t === 'op' && (ver() as { v: string }).v === v;
  const esperar = (v: string) => {
    if (!esOp(v)) throw new Error(`Se esperaba "${v}"`);
    pos++;
  };

  function ternario(): Nodo {
    const c = nivel(0);
    if (esOp('?')) {
      pos++;
      const a = ternario();
      esperar(':');
      const b = ternario();
      return { k: 'si', c, a, b };
    }
    return c;
  }

  function nivel(n: number): Nodo {
    if (n >= NIVELES.length) return unario();
    let a = nivel(n + 1);
    while (ver()?.t === 'op' && NIVELES[n].includes((ver() as { v: string }).v)) {
      const op = (tokens[pos++] as { v: string }).v;
      a = { k: 'bin', op, a, b: nivel(n + 1) };
    }
    return a;
  }

  function unario(): Nodo {
    if (esOp('-') || esOp('!') || esOp('+')) {
      const op = (tokens[pos++] as { v: string }).v;
      return { k: 'un', op, a: unario() };
    }
    return primario();
  }

  function primario(): Nodo {
    const tk = tokens[pos++];
    if (!tk) throw new Error('Expresión incompleta');
    if (tk.t === 'num' || tk.t === 'txt') return { k: 'lit', v: tk.v };
    if (tk.t === 'ref') return { k: 'ref', v: tk.v };
    if (tk.t === 'id') {
      if (tk.v === 'VERDADERO' || tk.v === 'TRUE') return { k: 'lit', v: true };
      if (tk.v === 'FALSO' || tk.v === 'FALSE') return { k: 'lit', v: false };
      if (!(tk.v in FUNCIONES)) throw new Error(`Función desconocida: ${tk.v}`);
      esperar('(');
      const args: Nodo[] = [];
      if (!esOp(')')) {
        args.push(ternario());
        while (esOp(',')) { pos++; args.push(ternario()); }
      }
      esperar(')');
      return { k: 'fn', nombre: tk.v, args };
    }
    if (tk.v === '(') {
      const e = ternario();
      esperar(')');
      return e;
    }
    throw new Error(`Símbolo inesperado: ${tk.v}`);
  }

  const raiz = ternario();
  if (pos < tokens.length) throw new Error('Sobran símbolos al final');
  return raiz;
}

// ── Conversión de valores ─────────────────────────────────────────────────────

function aDato(v: Valor | undefined): Dato {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    // checkbox / fotos (string[]) o repetible (Fila[]): como lista
    return (v as unknown[]).map((x) => (typeof x === 'string' ? x : '•')) as Dato[];
  }
  const u = v as Ubicacion;
  return `${u.lat},${u.lon}`;
}

/** Busca un valor desde la fila más interna hacia afuera. */
export function buscarValor(ctx: Contexto, key: string): Valor | undefined {
  for (let i = ctx.length - 1; i >= 0; i--) {
    if (key in ctx[i]) return ctx[i][key];
  }
  return undefined;
}

function resolverRef(ref: string, ctx: Contexto): Dato {
  const [grupo, sub] = ref.split('.');
  if (sub === undefined) return aDato(buscarValor(ctx, grupo));
  const filas = buscarValor(ctx, grupo);
  if (!Array.isArray(filas)) return [];
  return (filas as Fila[]).map((f) => aDato(f?.[sub]));
}

function num(d: Dato): number {
  if (typeof d === 'number') return d;
  if (typeof d === 'boolean') return d ? 1 : 0;
  if (d === null || d === '') return 0;
  if (Array.isArray(d)) return NaN;
  const s = d.trim();
  if (s === 'Si') return 1;
  if (s === 'No') return 0;
  return s === '' ? 0 : Number(s);
}

function txt(d: Dato): string {
  if (d === null) return '';
  if (typeof d === 'boolean') return d ? 'Si' : 'No';
  if (Array.isArray(d)) return d.map(txt).join(', ');
  return String(d);
}

function verdad(d: Dato): boolean {
  if (typeof d === 'boolean') return d;
  if (typeof d === 'number') return d !== 0 && !Number.isNaN(d);
  if (Array.isArray(d)) return d.length > 0;
  if (d === null) return false;
  const s = d.trim();
  return s !== '' && s !== 'No' && s !== '0';
}

function aplanar(args: Dato[]): Dato[] {
  return args.flatMap((a) => (Array.isArray(a) ? aplanar(a) : [a]));
}

function numeros(args: Dato[]): number[] {
  return aplanar(args).filter((d) => d !== '' && d !== null).map(num);
}

function iguales(a: Dato, b: Dato): boolean {
  const na = num(a), nb = num(b);
  if (typeof a !== 'string' || typeof b !== 'string') {
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  }
  return txt(a) === txt(b);
}

// ── Funciones disponibles ─────────────────────────────────────────────────────

const FUNCIONES: Record<string, (args: Dato[]) => Dato> = {
  SUMA: (a) => numeros(a).reduce((s, n) => s + n, 0),
  PROMEDIO: (a) => { const n = numeros(a); return n.length ? n.reduce((s, x) => s + x, 0) / n.length : ''; },
  MAX: (a) => { const n = numeros(a); return n.length ? Math.max(...n) : ''; },
  MIN: (a) => { const n = numeros(a); return n.length ? Math.min(...n) : ''; },
  CONTAR: (a) => aplanar(a).filter((d) => txt(d).trim() !== '').length,
  SI: (a) => (verdad(a[0]) ? a[1] ?? '' : a[2] ?? ''),
  Y: (a) => a.every(verdad),
  O: (a) => a.some(verdad),
  NO: (a) => !verdad(a[0]),
  REDONDEAR: (a) => { const d = Math.max(0, Math.trunc(num(a[1] ?? 0))); const f = 10 ** d; return Math.round(num(a[0]) * f) / f; },
  ENTERO: (a) => Math.trunc(num(a[0])),
  ABS: (a) => Math.abs(num(a[0])),
  TEXTO: (a) => num(a[0]).toFixed(Math.max(0, Math.trunc(num(a[1] ?? 0)))),
  CONCATENAR: (a) => aplanar(a).map(txt).join(''),
  HOY: () => new Date().toISOString().slice(0, 10),
  EDAD: (a) => {
    const s = txt(a[0]);
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return '';
    const nac = new Date(s + 'T00:00:00');
    const hoy = new Date();
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad >= 0 ? edad : '';
  },
};

export const FUNCIONES_DISPONIBLES = Object.keys(FUNCIONES);

// ── Evaluación ────────────────────────────────────────────────────────────────

function evaluar(n: Nodo, ctx: Contexto): Dato {
  switch (n.k) {
    case 'lit': return n.v;
    case 'ref': return resolverRef(n.v, ctx);
    case 'si': return verdad(evaluar(n.c, ctx)) ? evaluar(n.a, ctx) : evaluar(n.b, ctx);
    case 'fn': return FUNCIONES[n.nombre](n.args.map((a) => evaluar(a, ctx)));
    case 'un': {
      const a = evaluar(n.a, ctx);
      if (n.op === '!') return !verdad(a);
      return n.op === '-' ? -num(a) : num(a);
    }
    case 'bin': {
      if (n.op === '&&') return verdad(evaluar(n.a, ctx)) && verdad(evaluar(n.b, ctx));
      if (n.op === '||') return verdad(evaluar(n.a, ctx)) || verdad(evaluar(n.b, ctx));
      const a = evaluar(n.a, ctx), b = evaluar(n.b, ctx);
      switch (n.op) {
        case '+': return num(a) + num(b);
        case '-': return num(a) - num(b);
        case '*': return num(a) * num(b);
        case '/': return num(b) === 0 ? NaN : num(a) / num(b);
        case '%': return num(b) === 0 ? NaN : num(a) % num(b);
        case '&': return txt(a) + txt(b);
        case '=': case '==': case '===': return iguales(a, b);
        case '!=': case '!==': case '<>': return !iguales(a, b);
        case '<': return num(a) < num(b);
        case '>': return num(a) > num(b);
        case '<=': return num(a) <= num(b);
        case '>=': return num(a) >= num(b);
      }
    }
  }
  throw new Error('Expresión no soportada');
}

const cache = new Map<string, Nodo>();

function compilar(formula: string): Nodo {
  let arbol = cache.get(formula);
  if (!arbol) {
    arbol = analizar(tokenizar(formula));
    cache.set(formula, arbol);
  }
  return arbol;
}

/** Revisa una fórmula sin evaluarla. Devuelve el mensaje de error o null si está bien. */
export function revisarFormula(formula: string): string | null {
  try {
    compilar(formula);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/** Evalúa una fórmula y devuelve el resultado como texto ('' si no se puede calcular). */
export function evaluarFormula(formula: string | undefined, ctx: Contexto | Valores): string {
  if (!formula || !formula.trim()) return '';
  const contexto = Array.isArray(ctx) ? ctx : [ctx];
  try {
    const r = evaluar(compilar(formula), contexto);
    if (typeof r === 'number') {
      if (!Number.isFinite(r)) return '';
      return Number.isInteger(r) ? String(r) : String(parseFloat(r.toFixed(6)));
    }
    return txt(r);
  } catch {
    return '';
  }
}

/** Evalúa una fórmula como verdadero/falso (para validaciones tipo 'expresion'). */
export function evaluarVerdad(formula: string, ctx: Contexto | Valores): boolean {
  const contexto = Array.isArray(ctx) ? ctx : [ctx];
  try {
    return verdad(evaluar(compilar(formula), contexto));
  } catch {
    return false;
  }
}
