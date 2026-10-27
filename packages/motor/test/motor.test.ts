import { describe, expect, it } from 'vitest';
import {
  evaluarFormula, evaluarVerdad, revisarFormula, evaluarCondicion,
  seccionesVisibles, validarRegistro, calcularDerivados,
  type Esquema, type Valores,
} from '../src/index.ts';

describe('fórmulas', () => {
  const v: Valores = {
    produccion_anual: '1200', area_cacao: '3', vacio: '', nombre: 'Ana',
    fecha_nac: '1990-01-01', asociacion: 'Si',
    lotes: [{ area_cafe: '1.5' }, { area_cafe: '2' }, { area_cafe: '' }],
  };

  it('aritmética y funciones', () => {
    expect(evaluarFormula('{produccion_anual} / {area_cacao}', v)).toBe('400');
    expect(evaluarFormula('REDONDEAR(10 / 3, 2)', v)).toBe('3.33');
    expect(evaluarFormula('2 + 3 * 4', v)).toBe('14');
    expect(evaluarFormula('(2 + 3) * 4', v)).toBe('20');
    expect(evaluarFormula('-{area_cacao} + 1', v)).toBe('-2');
  });

  it('campo vacío cuenta como 0 y división por cero da vacío', () => {
    expect(evaluarFormula('{vacio} + 5', v)).toBe('5');
    expect(evaluarFormula('{produccion_anual} / {vacio}', v)).toBe('');
  });

  it('SI, comparaciones y texto', () => {
    expect(evaluarFormula('SI({area_cacao} > 0, "con área", "sin área")', v)).toBe('con área');
    expect(evaluarFormula('SI({asociacion} = "Si", 1, 0)', v)).toBe('1');
    expect(evaluarFormula('CONCATENAR("Hola ", {nombre})', v)).toBe('Hola Ana');
    expect(evaluarFormula('"Sra. " & {nombre}', v)).toBe('Sra. Ana');
    // sintaxis vieja de JavaScript sigue funcionando
    expect(evaluarFormula('{area_cacao} > 2 ? "grande" : "pequeña"', v)).toBe('grande');
  });

  it('columnas de grupos repetibles', () => {
    expect(evaluarFormula('SUMA({lotes.area_cafe})', v)).toBe('3.5');
    expect(evaluarFormula('CONTAR({lotes.area_cafe})', v)).toBe('2');
    expect(evaluarFormula('CONTAR({lotes})', v)).toBe('3');
  });

  it('EDAD calcula años cumplidos', () => {
    const edad = Number(evaluarFormula('EDAD({fecha_nac})', v));
    expect(edad).toBeGreaterThanOrEqual(36);
  });

  it('no ejecuta código: solo funciones permitidas', () => {
    expect(revisarFormula('alert(1)')).toMatch(/Función desconocida/);
    expect(revisarFormula('constructor.constructor("x")()')).not.toBeNull();
    expect(revisarFormula('{a}; fetch("x")')).not.toBeNull();
    expect(evaluarFormula('process.exit()', v)).toBe('');
    expect(revisarFormula('SUMA({a}, 2)')).toBeNull();
  });

  it('evaluarVerdad para validaciones', () => {
    expect(evaluarVerdad('{area_cacao} <= 10', v)).toBe(true);
    expect(evaluarVerdad('{area_cacao} > 10', v)).toBe(false);
  });
});

describe('condiciones', () => {
  it('reglas y lógica y/o', () => {
    const v: Valores = { pertenece: 'Si', edad: '30', cultivos: ['cafe', 'cacao'] };
    expect(evaluarCondicion({ logica: 'y', reglas: [{ campo: 'pertenece', operador: 'igual', valor: 'Si' }] }, v)).toBe(true);
    expect(evaluarCondicion({ logica: 'y', reglas: [
      { campo: 'pertenece', operador: 'igual', valor: 'Si' },
      { campo: 'edad', operador: 'mayor', valor: '40' },
    ] }, v)).toBe(false);
    expect(evaluarCondicion({ logica: 'o', reglas: [
      { campo: 'pertenece', operador: 'igual', valor: 'No' },
      { campo: 'edad', operador: 'mayor', valor: '18' },
    ] }, v)).toBe(true);
    expect(evaluarCondicion({ logica: 'y', reglas: [{ campo: 'cultivos', operador: 'contiene', valor: 'cacao' }] }, v)).toBe(true);
    expect(evaluarCondicion({ logica: 'y', reglas: [{ campo: 'nada', operador: 'vacio' }] }, v)).toBe(true);
    expect(evaluarCondicion({ logica: 'y', reglas: [{ campo: 'edad', operador: 'mayor', valor: '' }] }, { edad: '' })).toBe(false);
  });
});

const esquema: Esquema = {
  version: 2,
  claveNombre: 'nombre',
  secciones: [
    {
      id: 'productor', titulo: 'Productor',
      campos: [
        { key: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        { key: 'correo', etiqueta: 'Correo', tipo: 'email' },
        { key: 'pertenece', etiqueta: 'Pertenece a asociación', tipo: 'sino' },
        {
          key: 'cargo', etiqueta: 'Cargo', tipo: 'texto', obligatorio: true,
          condicion: { logica: 'y', reglas: [{ campo: 'pertenece', operador: 'igual', valor: 'Si' }] },
        },
      ],
    },
    {
      id: 'organizacion', titulo: 'Organización',
      condicion: { logica: 'y', reglas: [{ campo: 'pertenece', operador: 'igual', valor: 'Si' }] },
      campos: [{ key: 'nombre_asoc', etiqueta: 'Nombre asociación', tipo: 'texto', obligatorio: true }],
    },
    {
      id: 'lotes', titulo: 'Lotes',
      campos: [
        {
          key: 'lotes', etiqueta: 'Lotes', tipo: 'repetible', minFilas: 1, maxFilas: 5,
          campos: [
            { key: 'area_cafe', etiqueta: 'Área en café', tipo: 'decimal', obligatorio: true,
              validaciones: [{ tipo: 'min_valor', valor: '0' }] },
            { key: 'plantas', etiqueta: 'Plantas', tipo: 'numero' },
            { key: 'densidad', etiqueta: 'Densidad', tipo: 'calculado', formula: 'REDONDEAR({plantas} / {area_cafe}, 0)' },
          ],
        },
        { key: 'area_total', etiqueta: 'Área total', tipo: 'calculado', formula: 'SUMA({lotes.area_cafe})' },
      ],
    },
  ],
};

describe('validación de registros', () => {
  it('obligatorios y formatos', () => {
    const errores = validarRegistro(esquema, { correo: 'malo', lotes: [] });
    const rutas = errores.map((e) => e.ruta);
    expect(rutas).toContain('nombre');
    expect(rutas).toContain('correo');
    expect(rutas).toContain('lotes');
  });

  it('campos y secciones ocultos no se exigen', () => {
    const v: Valores = { nombre: 'Ana', pertenece: 'No', lotes: [{ area_cafe: '1' }] };
    expect(validarRegistro(esquema, v)).toEqual([]);
    expect(seccionesVisibles(esquema, v).map((s) => s.id)).toEqual(['productor', 'lotes']);
  });

  it('cuando la condición se cumple, sí se exigen', () => {
    const rutas = validarRegistro(esquema, { nombre: 'Ana', pertenece: 'Si', lotes: [{ area_cafe: '1' }] })
      .map((e) => e.ruta);
    expect(rutas).toEqual(['cargo', 'nombre_asoc']);
  });

  it('valida cada fila del repetible', () => {
    const errores = validarRegistro(esquema, {
      nombre: 'Ana', lotes: [{ area_cafe: '1' }, { area_cafe: '' }, { area_cafe: '-2', plantas: '1.5' }],
    });
    expect(errores.map((e) => e.ruta)).toEqual(['lotes[2].area_cafe', 'lotes[3].area_cafe', 'lotes[3].plantas']);
  });
});

describe('campos calculados', () => {
  it('calcula dentro de las filas y a nivel de registro', () => {
    const v = calcularDerivados(esquema, {
      lotes: [{ area_cafe: '2', plantas: '10000' }, { area_cafe: '0.5', plantas: '2000' }],
    });
    expect((v.lotes as Valores[]).map((f) => f.densidad)).toEqual(['5000', '4000']);
    expect(v.area_total).toBe('2.5');
  });

  it('no modifica el objeto original', () => {
    const original: Valores = { lotes: [{ area_cafe: '2', plantas: '10' }] };
    calcularDerivados(esquema, original);
    expect((original.lotes as Valores[])[0].densidad).toBeUndefined();
  });
});
