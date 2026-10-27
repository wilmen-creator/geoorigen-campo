// Visibilidad de secciones y campos según las respuestas.

import type { Condicion, Regla, Valor, Valores, Campo, Seccion, Esquema, Ubicacion } from './tipos.ts';
import { buscarValor, type Contexto } from './formulas.ts';

function comoTexto(v: Valor | undefined): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.length ? String(v.length) : '';
  const u = v as Ubicacion;
  return `${u.lat},${u.lon}`;
}

export function esVacio(v: Valor | undefined): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

export function evaluarRegla(r: Regla, ctx: Contexto): boolean {
  const v = buscarValor(ctx, r.campo);
  const obj = String(r.valor ?? '').trim();

  // checkbox: la regla se cumple si alguna de las opciones marcadas coincide
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
    const marcadas = v as string[];
    switch (r.operador) {
      case 'igual': case 'contiene': return marcadas.includes(obj);
      case 'diferente': case 'no_contiene': return !marcadas.includes(obj);
      case 'vacio': return marcadas.length === 0;
      case 'no_vacio': return marcadas.length > 0;
    }
  }

  const val = comoTexto(v);
  const a = val.toLowerCase(), b = obj.toLowerCase();
  switch (r.operador) {
    case 'igual': return val === obj;
    case 'diferente': return val !== obj;
    case 'contiene': return a.includes(b);
    case 'no_contiene': return !a.includes(b);
    case 'empieza_con': return a.startsWith(b);
    case 'termina_con': return a.endsWith(b);
    case 'mayor': return val !== '' && Number(val) > Number(obj);
    case 'menor': return val !== '' && Number(val) < Number(obj);
    case 'mayor_igual': return val !== '' && Number(val) >= Number(obj);
    case 'menor_igual': return val !== '' && Number(val) <= Number(obj);
    case 'vacio': return esVacio(v);
    case 'no_vacio': return !esVacio(v);
  }
  return true;
}

export function evaluarCondicion(c: Condicion | null | undefined, ctx: Contexto | Valores): boolean {
  if (!c || !c.reglas || c.reglas.length === 0) return true;
  const contexto = Array.isArray(ctx) ? ctx : [ctx];
  const r = c.reglas.map((regla) => evaluarRegla(regla, contexto));
  return c.logica === 'o' ? r.some(Boolean) : r.every(Boolean);
}

export function seccionesVisibles(esquema: Esquema, valores: Valores): Seccion[] {
  return esquema.secciones.filter((s) => evaluarCondicion(s.condicion, [valores]));
}

export function camposVisibles(campos: Campo[], ctx: Contexto | Valores): Campo[] {
  return campos.filter((c) => evaluarCondicion(c.condicion, ctx));
}
