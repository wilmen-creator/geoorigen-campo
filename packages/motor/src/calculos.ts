// Rellena los campos calculados (también dentro de cada fila de un repetible),
// para que el valor quede guardado con el registro y se vea igual en el panel.

import type { Campo, Esquema, Fila, Valores } from './tipos.ts';
import { evaluarFormula, type Contexto } from './formulas.ts';

function calcularCampos(campos: Campo[], ctx: Contexto): void {
  const actual = ctx[ctx.length - 1];
  for (const campo of campos) {
    if (campo.tipo === 'repetible' && Array.isArray(actual[campo.key])) {
      actual[campo.key] = (actual[campo.key] as Fila[]).map((fila) => {
        const copia: Fila = { ...fila };
        calcularCampos(campo.campos ?? [], [...ctx, copia]);
        return copia;
      });
    } else if (campo.tipo === 'calculado') {
      actual[campo.key] = evaluarFormula(campo.formula, ctx);
    }
  }
}

/**
 * Devuelve una copia de los valores con los calculados al día.
 * Se hacen dos pasadas para que un calculado pueda usar otro que esté más abajo.
 */
export function calcularDerivados(esquema: Esquema, valores: Valores): Valores {
  const resultado: Valores = { ...valores };
  const campos = esquema.secciones.flatMap((s) => s.campos);
  calcularCampos(campos, [resultado]);
  calcularCampos(campos, [resultado]);
  return resultado;
}
