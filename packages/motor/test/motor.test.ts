import { describe, expect, it } from 'vitest';
import {
  evaluarFormula, evaluarVerdad, revisarFormula, evaluarCondicion,
  seccionesVisibles, validarRegistro, calcularDerivados, armarQR, leerQR, aplicarQR, claveTitulo, claveUbicacionFinca, conCamposDeQR,
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

import { revisarEsquema } from '../src/index.ts';

describe('revisión del esquema antes de publicar', () => {
  it('el esquema de ejemplo no tiene problemas graves', () => {
    expect(revisarEsquema(esquema).filter((p) => p.grave)).toEqual([]);
  });

  it('detecta claves repetidas, fórmulas rotas y referencias inexistentes', () => {
    const malo: Esquema = {
      version: 2, claveNombre: 'no_existe',
      secciones: [{
        id: 's1', titulo: 'S1',
        campos: [
          { key: 'a', etiqueta: 'A', tipo: 'texto' },
          { key: 'a', etiqueta: 'A otra vez', tipo: 'texto' },
          { key: 'calc', etiqueta: 'Calc', tipo: 'calculado', formula: 'SUMA({a}, {fantasma})' },
          { key: 'roto', etiqueta: 'Roto', tipo: 'calculado', formula: 'alert(1)' },
          { key: 'lista', etiqueta: 'Lista', tipo: 'select', opciones: [] },
          { key: 'cond', etiqueta: 'Cond', tipo: 'texto',
            condicion: { logica: 'y', reglas: [{ campo: 'nadie', operador: 'igual', valor: 'x' }] } },
          { key: 'grupo', etiqueta: 'Grupo', tipo: 'repetible', campos: [] },
          { key: 'Mal Clave', etiqueta: 'Mal', tipo: 'texto' },
        ],
      }],
    };
    const mensajes = revisarEsquema(malo).filter((p) => p.grave).map((p) => p.mensaje).join('\n');
    expect(mensajes).toMatch(/"a" está repetida/);
    expect(mensajes).toMatch(/\{fantasma\}/);
    expect(mensajes).toMatch(/Roto.*error/);
    expect(mensajes).toMatch(/Lista" no tiene opciones/);
    expect(mensajes).toMatch(/usa "nadie"/);
    expect(mensajes).toMatch(/Grupo" no tiene campos/);
    expect(mensajes).toMatch(/Mal.*minúsculas/);
    expect(mensajes).toMatch(/título "no_existe"/);
  });

  it('dentro de un repetible acepta referencias a la misma fila y a columnas', () => {
    expect(revisarEsquema(esquema).some((p) => p.campo === 'lotes.densidad')).toBe(false);
  });
});

describe('QR del productor', () => {
  const lineaBase: Esquema = {
    version: 2, claveNombre: 'nom', secciones: [{ id: 's', titulo: 'S', campos: [
      { key: 'cc', etiqueta: 'Cédula', tipo: 'texto', datoQR: 'cedula' },
      { key: 'nom', etiqueta: 'Nombre', tipo: 'texto', datoQR: 'nombre' },
      { key: 'fin', etiqueta: 'Finca', tipo: 'texto', datoQR: 'finca' },
      { key: 'gps', etiqueta: 'Ubicación', tipo: 'gps', datoQR: 'ubicacion' },
      { key: 'area', etiqueta: 'Área', tipo: 'decimal' },
    ] }],
  };
  const visita: Esquema = {
    version: 2, claveNombre: 'productor', secciones: [{ id: 's', titulo: 'S', campos: [
      { key: 'escaneo', etiqueta: 'QR', tipo: 'qr' },
      { key: 'documento', etiqueta: 'Documento', tipo: 'texto', datoQR: 'cedula' },
      { key: 'productor', etiqueta: 'Productor', tipo: 'texto', datoQR: 'nombre' },
      { key: 'punto_finca', etiqueta: 'Finca', tipo: 'gps', datoQR: 'ubicacion' },
      { key: 'obs', etiqueta: 'Observaciones', tipo: 'parrafo' },
    ] }],
  };
  const datos = { cc: '1061234', nom: 'María Gómez', fin: 'La Esperanza', gps: { lat: 2.4419871234, lon: -76.6063123, precision: 8 }, area: '2.5' };

  it('arma el QR solo con los datos marcados y lo vuelve a leer', () => {
    const texto = armarQR(lineaBase, datos, 'org1', 'reg1')!;
    expect(texto.startsWith('GEO1:')).toBe(true);
    expect(texto).not.toContain('2.5');  // el área no va en el QR
    const qr = leerQR(texto)!;
    expect(qr.r).toBe('reg1');
    expect(qr.d.cedula).toBe('1061234');
    expect(qr.d.ubicacion).toEqual({ lat: 2.441987, lon: -76.606312 });
  });

  it('llena la visita aunque las preguntas se llamen distinto', () => {
    const qr = leerQR(armarQR(lineaBase, datos, 'org1', 'reg1')!)!;
    const { datos: nuevos, llenados } = aplicarQR(visita, { obs: 'ok' }, 'escaneo', qr);
    expect(llenados).toBe(3);
    expect(nuevos).toMatchObject({ escaneo: 'reg1', documento: '1061234', productor: 'María Gómez', obs: 'ok' });
    expect(nuevos.punto_finca).toEqual({ lat: 2.441987, lon: -76.606312 });
  });

  it('el campo QR trae su lista de datos sin crear preguntas', () => {
    const simple: Esquema = { version: 2, claveNombre: '', secciones: [{ id: 's', titulo: 'S', campos: [
      { key: 'qr', etiqueta: 'QR', tipo: 'qr', traeQR: ['cedula', 'nombre', 'telefono', 'ubicacion'] },
      { key: 'obs', etiqueta: 'Observaciones', tipo: 'texto' },
    ] }] };
    const qr = leerQR(armarQR(lineaBase, datos, 'org1', 'reg1')!)!;
    const { datos: nuevos, llenados } = aplicarQR(simple, { qr_telefono: 'viejo' }, 'qr', qr);
    expect(llenados).toBe(3);
    expect(nuevos).toMatchObject({ qr: 'reg1', qr_cedula: '1061234', qr_nombre: 'María Gómez', qr_telefono: null });
    expect(claveTitulo(simple)).toBe('qr_nombre');
    expect(claveUbicacionFinca(simple)).toBe('qr_ubicacion');
    expect(conCamposDeQR(simple.secciones[0].campos).map((c) => c.key)).toEqual(['qr', 'qr_cedula', 'qr_nombre', 'qr_telefono', 'qr_ubicacion', 'obs']);
  });

  it('rechaza QR que no son de GeoOrigen', () => {
    expect(leerQR('https://ejemplo.com')).toBeNull();
    expect(leerQR('GEO1:{roto')).toBeNull();
    expect(armarQR(lineaBase, {}, 'o', 'r')).toBeNull();
  });
});
