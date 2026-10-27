// Revisión de un esquema antes de publicarlo. Los problemas graves impiden
// publicar (el formulario llegaría roto a la app); los avisos solo se muestran.

import type { Campo, Condicion, Esquema } from './tipos.ts';
import { TIPOS_CON_OPCIONES, TIPOS_SIN_VALOR } from './tipos.ts';
import { revisarFormula } from './formulas.ts';

export interface Problema {
  grave: boolean;
  seccionId?: string;
  /** Clave del campo (o 'grupo.campo' dentro de un repetible) */
  campo?: string;
  mensaje: string;
}

const RE_CLAVE = /^[a-z][a-z0-9_]*$/;
const RE_REF = /\{(\w+)(?:\.(\w+))?\}/g;

export function revisarEsquema(esquema: Esquema): Problema[] {
  const problemas: Problema[] = [];
  const grave = (mensaje: string, seccionId?: string, campo?: string) =>
    problemas.push({ grave: true, mensaje, seccionId, campo });
  const aviso = (mensaje: string, seccionId?: string, campo?: string) =>
    problemas.push({ grave: false, mensaje, seccionId, campo });

  if (esquema.secciones.length === 0) grave('El formulario no tiene secciones');

  // Claves de primer nivel y de cada repetible (para revisar referencias)
  const raiz = new Map<string, Campo>();
  const subcampos = new Map<string, Map<string, Campo>>();
  const vistas = new Set<string>();

  for (const sec of esquema.secciones) {
    for (const c of sec.campos) {
      if (vistas.has(c.key)) grave(`La clave "${c.key}" está repetida`, sec.id, c.key);
      vistas.add(c.key);
      raiz.set(c.key, c);
      if (c.tipo === 'repetible') {
        const hijos = new Map<string, Campo>();
        for (const h of c.campos ?? []) {
          if (hijos.has(h.key)) grave(`La clave "${h.key}" está repetida dentro de "${c.etiqueta}"`, sec.id, `${c.key}.${h.key}`);
          hijos.set(h.key, h);
        }
        subcampos.set(c.key, hijos);
      }
    }
  }

  const existe = (clave: string, grupo?: string) =>
    raiz.has(clave) || (grupo !== undefined && subcampos.get(grupo)?.has(clave));

  const revisarCondicion = (cond: Condicion | null | undefined, donde: string, seccionId: string, campo?: string, grupo?: string) => {
    for (const r of cond?.reglas ?? []) {
      if (!r.campo) grave(`${donde}: hay una condición sin campo elegido`, seccionId, campo);
      else if (!existe(r.campo, grupo)) grave(`${donde}: la condición usa "${r.campo}", que no existe`, seccionId, campo);
      else if (r.campo === campo?.split('.').pop()) grave(`${donde}: un campo no puede depender de sí mismo`, seccionId, campo);
    }
  };

  const revisarCampo = (c: Campo, seccionId: string, grupo?: string) => {
    const ruta = grupo ? `${grupo}.${c.key}` : c.key;
    const nombre = c.etiqueta || c.key;
    if (!RE_CLAVE.test(c.key)) grave(`"${nombre}": la clave solo puede tener minúsculas, números y _ (y empezar con letra)`, seccionId, ruta);
    if (!c.etiqueta.trim()) grave(`El campo "${c.key}" no tiene etiqueta`, seccionId, ruta);
    revisarCondicion(c.condicion, `"${nombre}"`, seccionId, ruta, grupo);

    if (TIPOS_CON_OPCIONES.includes(c.tipo)) {
      const ops = c.opciones ?? [];
      if (ops.length === 0) grave(`"${nombre}" no tiene opciones`, seccionId, ruta);
      if (ops.some((o) => !o.valor.trim() || !o.etiqueta.trim())) grave(`"${nombre}" tiene opciones vacías`, seccionId, ruta);
      if (new Set(ops.map((o) => o.valor)).size !== ops.length) grave(`"${nombre}" tiene opciones repetidas`, seccionId, ruta);
    }

    if (c.tipo === 'calculado') {
      const f = c.formula ?? '';
      if (!f.trim()) grave(`"${nombre}": falta la fórmula`, seccionId, ruta);
      else {
        const err = revisarFormula(f);
        if (err) grave(`"${nombre}": fórmula con error (${err})`, seccionId, ruta);
        for (const [, a, b] of f.matchAll(RE_REF)) {
          if (b !== undefined) {
            if (!subcampos.get(a)?.has(b)) grave(`"${nombre}": la fórmula usa {${a}.${b}}, que no existe`, seccionId, ruta);
          } else if (!existe(a, grupo)) {
            grave(`"${nombre}": la fórmula usa {${a}}, que no existe`, seccionId, ruta);
          }
        }
      }
    }

    for (const v of c.validaciones ?? []) {
      if (!String(v.valor ?? '').trim()) grave(`"${nombre}": hay una validación sin valor`, seccionId, ruta);
      else if (v.tipo === 'patron') {
        try { new RegExp(v.valor); } catch { grave(`"${nombre}": el patrón no es válido`, seccionId, ruta); }
      } else if (v.tipo === 'expresion') {
        const err = revisarFormula(v.valor);
        if (err) grave(`"${nombre}": la regla tiene un error (${err})`, seccionId, ruta);
      }
    }

    if (c.tipo === 'repetible') {
      if (grupo) grave(`"${nombre}": no se puede poner un grupo repetible dentro de otro`, seccionId, ruta);
      if ((c.campos ?? []).length === 0) grave(`El grupo "${nombre}" no tiene campos`, seccionId, ruta);
      if (c.minFilas && c.maxFilas && c.minFilas > c.maxFilas) grave(`"${nombre}": el mínimo de filas es mayor que el máximo`, seccionId, ruta);
      for (const h of c.campos ?? []) revisarCampo(h, seccionId, c.key);
    }
  };

  for (const sec of esquema.secciones) {
    if (!sec.titulo.trim()) aviso('Hay una sección sin título', sec.id);
    if (sec.campos.length === 0) aviso(`La sección "${sec.titulo}" no tiene campos`, sec.id);
    revisarCondicion(sec.condicion, `Sección "${sec.titulo}"`, sec.id);
    for (const c of sec.campos) revisarCampo(c, sec.id);
  }

  const conValor = [...raiz.values()].filter((c) => !TIPOS_SIN_VALOR.includes(c.tipo));
  if (conValor.length === 0) grave('El formulario no tiene ninguna pregunta');

  if (!esquema.claveNombre) aviso('Elige qué campo se muestra como título de cada registro');
  else if (!raiz.has(esquema.claveNombre)) grave(`El campo de título "${esquema.claveNombre}" no existe`);
  if (esquema.claveSubtitulo && !raiz.has(esquema.claveSubtitulo)) grave(`El campo de subtítulo "${esquema.claveSubtitulo}" no existe`);
  if (esquema.claveUbicacion) {
    const u = raiz.get(esquema.claveUbicacion);
    if (!u) grave(`El campo de ubicación de la finca "${esquema.claveUbicacion}" no existe`);
    else if (u.tipo !== 'gps') grave('El campo de ubicación de la finca debe ser de tipo GPS');
  } else if ([...raiz.values()].some((c) => c.tipo === 'gps')) {
    aviso('Elige cuál campo GPS es la ubicación de la finca, para comparar con el punto de captura');
  }

  return problemas;
}
