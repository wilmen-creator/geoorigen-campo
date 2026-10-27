// Validación de un registro contra su esquema. La usan la app (antes de enviar)
// y el panel (al revisar), así que las dos aplican exactamente las mismas reglas.

import type { Campo, Esquema, Fila, Valores } from './tipos.ts';
import { TIPOS_SIN_VALOR } from './tipos.ts';
import { camposVisibles, esVacio, seccionesVisibles } from './condiciones.ts';
import { evaluarVerdad, type Contexto } from './formulas.ts';

export interface ErrorValidacion {
  /** Sección donde está el campo */
  seccionId: string;
  /** Ruta del campo: 'nombre' o 'lotes[2].area_cafe' (filas desde 1) */
  ruta: string;
  mensaje: string;
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{2}:\d{2}(:\d{2})?$/;

function validarCampo(campo: Campo, ctx: Contexto, ruta: string, seccionId: string): ErrorValidacion[] {
  const errores: ErrorValidacion[] = [];
  const err = (mensaje: string) => errores.push({ seccionId, ruta, mensaje });
  const v = ctx[ctx.length - 1][campo.key];

  if (campo.obligatorio && esVacio(v)) {
    err(`${campo.etiqueta} es obligatorio`);
    return errores;
  }
  // Un repetible vacío aún debe revisar su mínimo de filas
  if (esVacio(v) && campo.tipo !== 'repetible') return errores;

  // Formato según el tipo
  const s = typeof v === 'string' ? v.trim() : '';
  switch (campo.tipo) {
    case 'numero':
      if (!/^-?\d+$/.test(s)) err(`${campo.etiqueta} debe ser un número entero`);
      break;
    case 'decimal':
      if (s === '' || Number.isNaN(Number(s))) err(`${campo.etiqueta} debe ser un número`);
      break;
    case 'email':
      if (!RE_EMAIL.test(s)) err(`${campo.etiqueta} no es un correo válido`);
      break;
    case 'fecha':
      if (!RE_FECHA.test(s)) err(`${campo.etiqueta} no es una fecha válida`);
      break;
    case 'hora':
      if (!RE_HORA.test(s)) err(`${campo.etiqueta} no es una hora válida`);
      break;
    case 'select': case 'radio':
      if (campo.opciones && !campo.opciones.some((o) => o.valor === s)) err(`${campo.etiqueta}: opción no válida`);
      break;
    case 'foto':
      if (Array.isArray(v) && campo.maxFotos && v.length > campo.maxFotos) err(`${campo.etiqueta}: máximo ${campo.maxFotos} fotos`);
      break;
    case 'repetible': {
      const filas = (Array.isArray(v) ? v : []) as Fila[];
      if (campo.minFilas && filas.length < campo.minFilas) err(`${campo.etiqueta}: mínimo ${campo.minFilas}`);
      if (campo.maxFilas && filas.length > campo.maxFilas) err(`${campo.etiqueta}: máximo ${campo.maxFilas}`);
      filas.forEach((fila, i) => {
        errores.push(...validarCampos(campo.campos ?? [], [...ctx, fila], `${ruta}[${i + 1}].`, seccionId));
      });
      break;
    }
  }

  // Reglas adicionales configuradas en el editor
  for (const val of campo.validaciones ?? []) {
    const n = Number(s), lim = Number(val.valor);
    switch (val.tipo) {
      case 'min_longitud':
        if (s.length < lim) err(val.mensaje || `Mínimo ${val.valor} caracteres`);
        break;
      case 'max_longitud':
        if (s.length > lim) err(val.mensaje || `Máximo ${val.valor} caracteres`);
        break;
      case 'min_valor':
        if (n < lim) err(val.mensaje || `Valor mínimo: ${val.valor}`);
        break;
      case 'max_valor':
        if (n > lim) err(val.mensaje || `Valor máximo: ${val.valor}`);
        break;
      case 'patron':
        try {
          if (!new RegExp(val.valor).test(s)) err(val.mensaje || 'Formato inválido');
        } catch { /* patrón mal escrito en el editor: se ignora */ }
        break;
      case 'expresion':
        if (!evaluarVerdad(val.valor, ctx)) err(val.mensaje || 'Validación no cumplida');
        break;
    }
  }
  return errores;
}

function validarCampos(campos: Campo[], ctx: Contexto, prefijo: string, seccionId: string): ErrorValidacion[] {
  return camposVisibles(campos, ctx)
    .filter((c) => !TIPOS_SIN_VALOR.includes(c.tipo) && c.tipo !== 'calculado')
    .flatMap((c) => validarCampo(c, ctx, prefijo + c.key, seccionId));
}

/** Valida las secciones y campos visibles. Lista vacía = el registro está completo. */
export function validarRegistro(esquema: Esquema, valores: Valores): ErrorValidacion[] {
  return seccionesVisibles(esquema, valores)
    .flatMap((s) => validarCampos(s.campos, [valores], '', s.id));
}
