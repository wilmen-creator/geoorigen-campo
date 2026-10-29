// Panel derecho del editor: propiedades del campo seleccionado.

import { useState } from 'react';
import { Plus, X, AlertTriangle } from 'lucide-react';
import {
  revisarFormula, evaluarFormula, FUNCIONES_DISPONIBLES, DATOS_QR,
  type Campo, type Condicion, type DatoQR, type Opcion, type TipoCampo, type Validacion,
} from '@geoorigen/motor';
import { OPERADORES, VALIDACIONES, aClave, metaTipo } from './catalogo.ts';

/** Tipos de campo que pueden ser un dato del productor en el QR */
const TIPOS_DATO_QR: TipoCampo[] = ['texto', 'parrafo', 'numero', 'tel', 'select', 'radio', 'gps'];

export interface CampoReferencia {
  key: string;
  etiqueta: string;
}

// ── Condición (también la usa la sección) ─────────────────────────────────────

export function EditorCondicion({ condicion, onChange, campos }: {
  condicion: Condicion;
  onChange: (c: Condicion | null) => void;
  campos: CampoReferencia[];
}) {
  const setRegla = (i: number, cambio: Partial<Condicion['reglas'][number]>) =>
    onChange({ ...condicion, reglas: condicion.reglas.map((r, j) => (j === i ? { ...r, ...cambio } : r)) });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">Mostrar cuando se cumplan</span>
        {(['y', 'o'] as const).map((l) => (
          <button key={l} onClick={() => onChange({ ...condicion, logica: l })}
            className={`rounded px-2 py-0.5 ${condicion.logica === l ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
            {l === 'y' ? 'todas' : 'alguna'}
          </button>
        ))}
      </div>
      {condicion.reglas.map((r, i) => {
        const sinValor = OPERADORES.find((o) => o.op === r.operador)?.sinValor;
        return (
          <div key={i} className="space-y-1 rounded-lg border border-gray-100 bg-white p-2">
            <div className="flex gap-1">
              <select className="input h-8 py-1 text-xs" value={r.campo} onChange={(e) => setRegla(i, { campo: e.target.value })}>
                <option value="">— Campo —</option>
                {campos.map((c) => <option key={c.key} value={c.key}>{c.etiqueta}</option>)}
              </select>
              <button className="btn-icon shrink-0 hover:text-red-600" title="Quitar"
                onClick={() => {
                  const reglas = condicion.reglas.filter((_, j) => j !== i);
                  onChange(reglas.length ? { ...condicion, reglas } : null);
                }}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-1">
              <select className="input h-8 py-1 text-xs" value={r.operador}
                onChange={(e) => setRegla(i, { operador: e.target.value as typeof r.operador })}>
                {OPERADORES.map((o) => <option key={o.op} value={o.op}>{o.etiqueta}</option>)}
              </select>
              {!sinValor && (
                <input className="input h-8 py-1 text-xs" placeholder="Valor" value={r.valor ?? ''}
                  onChange={(e) => setRegla(i, { valor: e.target.value })} />
              )}
            </div>
          </div>
        );
      })}
      <button className="flex items-center gap-1 text-xs text-primary hover:underline"
        onClick={() => onChange({ ...condicion, reglas: [...condicion.reglas, { campo: '', operador: 'igual', valor: '' }] })}>
        <Plus className="h-3 w-3" /> Agregar condición
      </button>
    </div>
  );
}

// ── Opciones de listas ────────────────────────────────────────────────────────

function EditorOpciones({ opciones, onChange, publicadas }: {
  opciones: Opcion[];
  onChange: (o: Opcion[]) => void;
  publicadas: Set<string>;
}) {
  const [texto, setTexto] = useState('');
  const pegar = () => {
    // Pegar varias opciones de una vez, una por línea
    const nuevas = texto.split('\n').map((t) => t.trim()).filter(Boolean);
    const usados = new Set(opciones.map((o) => o.valor));
    const agregar = nuevas.map((etiqueta) => {
      let valor = aClave(etiqueta);
      for (let n = 2; usados.has(valor); n++) valor = `${aClave(etiqueta)}_${n}`;
      usados.add(valor);
      return { valor, etiqueta };
    });
    onChange([...opciones, ...agregar]);
    setTexto('');
  };

  return (
    <div className="space-y-1.5">
      {opciones.map((o, i) => (
        <div key={i} className="flex gap-1">
          <input className="input h-8 py-1 text-xs" value={o.etiqueta} placeholder={`Opción ${i + 1}`}
            onChange={(e) => {
              const etiqueta = e.target.value;
              // El valor guardado sigue a la etiqueta mientras la opción no se haya publicado
              const valor = publicadas.has(o.valor) ? o.valor : aClave(etiqueta);
              onChange(opciones.map((x, j) => (j === i ? { valor, etiqueta } : x)));
            }} />
          <button className="btn-icon shrink-0 hover:text-red-600" title="Quitar"
            onClick={() => onChange(opciones.filter((_, j) => j !== i))}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <textarea className="input text-xs" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="Pega aquí varias opciones, una por línea" />
      <button className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-40"
        disabled={!texto.trim()} onClick={pegar}>
        <Plus className="h-3 w-3" /> Agregar opciones
      </button>
    </div>
  );
}

// ── Validaciones ──────────────────────────────────────────────────────────────

function EditorValidaciones({ campo, onChange }: { campo: Campo; onChange: (v: Validacion[]) => void }) {
  const disponibles = VALIDACIONES.filter((v) => v.para.includes(campo.tipo));
  const lista = campo.validaciones ?? [];
  if (disponibles.length === 0) return <p className="text-xs text-gray-400">Este tipo de campo no tiene validaciones extra.</p>;

  return (
    <div className="space-y-2">
      {lista.map((v, i) => {
        const meta = VALIDACIONES.find((d) => d.tipo === v.tipo);
        const errorFormula = v.tipo === 'expresion' && v.valor ? revisarFormula(v.valor) : null;
        const upd = (cambio: Partial<Validacion>) => onChange(lista.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
        return (
          <div key={i} className="space-y-1 rounded-lg border border-gray-100 bg-white p-2">
            <div className="flex gap-1">
              <select className="input h-8 py-1 text-xs" value={v.tipo}
                onChange={(e) => upd({ tipo: e.target.value as Validacion['tipo'] })}>
                {disponibles.map((d) => <option key={d.tipo} value={d.tipo}>{d.etiqueta}</option>)}
              </select>
              <button className="btn-icon shrink-0 hover:text-red-600" onClick={() => onChange(lista.filter((_, j) => j !== i))}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <input className="input h-8 py-1 font-mono text-xs" value={v.valor} placeholder={`Ej: ${meta?.ejemplo}`}
              onChange={(e) => upd({ valor: e.target.value })} />
            {errorFormula && <p className="text-xs text-red-600">{errorFormula}</p>}
            <input className="input h-8 py-1 text-xs" value={v.mensaje ?? ''} placeholder="Mensaje para el colaborador (opcional)"
              onChange={(e) => upd({ mensaje: e.target.value })} />
          </div>
        );
      })}
      <button className="flex items-center gap-1 text-xs text-primary hover:underline"
        onClick={() => onChange([...lista, { tipo: disponibles[0].tipo, valor: '' }])}>
        <Plus className="h-3 w-3" /> Agregar validación
      </button>
    </div>
  );
}

// ── Fórmula ───────────────────────────────────────────────────────────────────

function EditorFormula({ campo, onChange, referencias }: {
  campo: Campo;
  onChange: (f: string) => void;
  referencias: CampoReferencia[];
}) {
  const formula = campo.formula ?? '';
  const error = formula.trim() ? revisarFormula(formula) : null;
  const insertar = (t: string) => onChange(formula + t);

  return (
    <div className="space-y-3">
      <textarea className="input font-mono text-sm" rows={3} value={formula}
        onChange={(e) => onChange(e.target.value)} placeholder="Ej: REDONDEAR({produccion} / {area}, 1)" />
      {error ? (
        <p className="flex items-start gap-1 text-xs text-red-600"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {error}</p>
      ) : formula.trim() ? (
        <p className="text-xs text-primary">Fórmula válida · con todo vacío da: <strong>{evaluarFormula(formula, {}) || '(vacío)'}</strong></p>
      ) : null}
      <div>
        <p className="label">Toca para insertar un campo</p>
        <div className="flex flex-wrap gap-1">
          {referencias.map((r) => (
            <button key={r.key} onClick={() => insertar(`{${r.key}}`)} title={r.etiqueta}
              className="rounded bg-geo-gray px-1.5 py-0.5 font-mono text-xs text-primary hover:bg-primary-light">
              {`{${r.key}}`}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label">Funciones</p>
        <div className="flex flex-wrap gap-1">
          {FUNCIONES_DISPONIBLES.map((f) => (
            <button key={f} onClick={() => insertar(`${f}(`)}
              className="rounded border border-gray-200 px-1.5 py-0.5 font-mono text-xs text-gray-600 hover:border-primary hover:text-primary">
              {f}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Operadores: + − * / · comparaciones = &lt;&gt; &lt; &gt; · texto con &amp;.
          En un grupo repetible, <code>{'{lotes.area}'}</code> es la columna completa.
        </p>
      </div>
    </div>
  );
}

// ── Panel completo ────────────────────────────────────────────────────────────

type Pestana = 'basico' | 'opciones' | 'formula' | 'condicion' | 'validacion';

export function Propiedades({ campo, onChange, onCerrar, referencias, clavePublicada, opcionesPublicadas, clavesUsadas, enGrupo }: {
  campo: Campo;
  /** El campo está dentro de un grupo repetible (no puede ser dato del QR) */
  enGrupo: boolean;
  onChange: (c: Campo) => void;
  onCerrar: () => void;
  /** Campos que se pueden usar en condiciones y fórmulas */
  referencias: CampoReferencia[];
  /** La clave ya está en una versión publicada: cambiarla separaría los datos */
  clavePublicada: boolean;
  opcionesPublicadas: Set<string>;
  clavesUsadas: Set<string>;
}) {
  const [pestana, setPestana] = useState<Pestana>('basico');
  const set = (cambio: Partial<Campo>) => onChange({ ...campo, ...cambio });
  const meta = metaTipo(campo.tipo);
  const conValor = !['separador', 'instruccion'].includes(campo.tipo);
  const claveDuplicada = clavesUsadas.has(campo.key);

  const pestanas: { id: Pestana; texto: string }[] = [
    { id: 'basico', texto: 'Básico' },
    ...(['select', 'radio', 'checkbox'].includes(campo.tipo) ? [{ id: 'opciones' as const, texto: 'Opciones' }] : []),
    ...(campo.tipo === 'calculado' ? [{ id: 'formula' as const, texto: 'Fórmula' }] : []),
    { id: 'condicion', texto: 'Condición' },
    ...(conValor && campo.tipo !== 'calculado' ? [{ id: 'validacion' as const, texto: 'Validación' }] : []),
  ];
  const actual = pestanas.some((p) => p.id === pestana) ? pestana : 'basico';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-semibold">{meta?.icono} {meta?.etiqueta}</p>
        <button className="btn-icon" onClick={onCerrar}><X className="h-4 w-4" /></button>
      </div>
      <div className="flex overflow-x-auto border-b border-gray-100">
        {pestanas.map((p) => (
          <button key={p.id} onClick={() => setPestana(p.id)}
            className={`border-b-2 px-3 py-2 text-xs font-medium whitespace-nowrap ${
              actual === p.id ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {p.texto}
            {p.id === 'condicion' && campo.condicion ? ' •' : ''}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {actual === 'basico' && (
          <>
            <div>
              <label className="label">{campo.tipo === 'instruccion' ? 'Título corto' : 'Pregunta / etiqueta'}</label>
              <input className="input" value={campo.etiqueta}
                onChange={(e) => {
                  const etiqueta = e.target.value;
                  // La clave sigue a la etiqueta mientras no se haya publicado ni editado a mano
                  const auto = !clavePublicada && campo.key.replace(/_\d+$/, '') === aClave(campo.etiqueta);
                  set(auto ? { etiqueta, key: aClave(etiqueta) } : { etiqueta });
                }} />
            </div>
            <div>
              <label className="label">Clave interna</label>
              <input className="input font-mono text-xs" value={campo.key}
                onChange={(e) => set({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
              {claveDuplicada && <p className="mt-1 text-xs text-red-600">Ya hay otro campo con esta clave.</p>}
              {clavePublicada ? (
                <p className="mt-1 text-xs text-amber-700">
                  Ya está publicada: si la cambias, los registros viejos y nuevos quedarán en columnas distintas.
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">Nombre de la columna al exportar. Se usa en fórmulas como {`{${campo.key}}`}.</p>
              )}
            </div>

            {campo.tipo === 'instruccion' && (
              <div>
                <label className="label">Texto de la instrucción</label>
                <textarea className="input" rows={4} value={campo.ayuda ?? ''} onChange={(e) => set({ ayuda: e.target.value })} />
              </div>
            )}

            {conValor && campo.tipo !== 'calculado' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={!!campo.obligatorio}
                  onChange={(e) => set({ obligatorio: e.target.checked })} />
                Obligatorio
              </label>
            )}

            {conValor && !['repetible', 'foto', 'firma', 'gps'].includes(campo.tipo) && (
              <div>
                <label className="label">Ancho</label>
                <select className="input" value={campo.ancho ?? 'completo'}
                  onChange={(e) => set({ ancho: e.target.value as Campo['ancho'] })}>
                  <option value="completo">Toda la fila</option>
                  <option value="medio">Media fila</option>
                </select>
              </div>
            )}

            {conValor && campo.tipo !== 'instruccion' && (
              <div>
                <label className="label">Texto de ayuda</label>
                <input className="input" value={campo.ayuda ?? ''} placeholder="Aparece debajo del campo"
                  onChange={(e) => set({ ayuda: e.target.value })} />
              </div>
            )}

            {['texto', 'parrafo', 'numero', 'decimal', 'email', 'tel'].includes(campo.tipo) && (
              <div>
                <label className="label">Texto de ejemplo dentro del campo</label>
                <input className="input" value={campo.placeholder ?? ''} onChange={(e) => set({ placeholder: e.target.value })} />
              </div>
            )}

            {['texto', 'numero', 'decimal', 'select', 'radio', 'sino', 'fecha'].includes(campo.tipo) && (
              <div>
                <label className="label">Valor por defecto</label>
                <input className="input" value={campo.valorDefecto ?? ''} onChange={(e) => set({ valorDefecto: e.target.value })} />
              </div>
            )}

            {campo.tipo === 'calificacion' && (
              <div>
                <label className="label">Estrellas</label>
                <select className="input" value={campo.estrellas ?? 5} onChange={(e) => set({ estrellas: Number(e.target.value) })}>
                  {[3, 4, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}

            {campo.tipo === 'foto' && (
              <>
                <div>
                  <label className="label">Máximo de fotos</label>
                  <input type="number" min={1} max={20} className="input" value={campo.maxFotos ?? 5}
                    onChange={(e) => set({ maxFotos: Math.max(1, Number(e.target.value) || 1) })} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-primary" checked={campo.permitirGaleria !== false}
                    onChange={(e) => set({ permitirGaleria: e.target.checked })} />
                  Permitir subir desde la galería
                </label>
                <p className="text-xs text-gray-400">Las fotos de galería se marcan en el panel con su fecha y GPS originales.</p>
              </>
            )}

            {campo.tipo === 'qr' && (
              <div className="space-y-2">
                <label className="label">Datos que trae el QR</label>
                {DATOS_QR.map((d) => {
                  const lista = campo.traeQR ?? [];
                  return (
                    <label key={d.dato} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-primary" checked={lista.includes(d.dato)}
                        onChange={(e) => set({
                          // Se conserva el orden de la lista de datos
                          traeQR: DATOS_QR.map((x) => x.dato).filter((x) => (x === d.dato ? e.target.checked : lista.includes(x))),
                        })} />
                      {d.etiqueta}
                    </label>
                  );
                })}
                <p className="rounded-lg bg-primary-light px-3 py-2 text-xs text-primary">
                  En la app, al escanear el QR del productor, estos datos aparecen solos debajo del botón y no se
                  pueden editar. Salen de las preguntas que en la línea base tienen marcado «Dato del productor (QR)».
                  La ubicación se usa para la alerta de distancia a la finca.
                </p>
              </div>
            )}

            {!enGrupo && TIPOS_DATO_QR.includes(campo.tipo) && (
              <div>
                <label className="label">Dato del productor (QR)</label>
                <select className="input" value={campo.datoQR ?? ''}
                  onChange={(e) => set({ datoQR: (e.target.value || undefined) as DatoQR | undefined })}>
                  <option value="">— Ninguno —</option>
                  {DATOS_QR.filter((d) => (campo.tipo === 'gps') === (d.dato === 'ubicacion'))
                    .map((d) => <option key={d.dato} value={d.dato}>{d.etiqueta}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  En la línea base: este dato va dentro del QR del productor. En una visita: se llena solo al escanear el QR.
                </p>
              </div>
            )}

            {campo.tipo === 'repetible' && (
              <>
                <div>
                  <label className="label">Nombre de cada fila</label>
                  <input className="input" value={campo.etiquetaFila ?? ''} placeholder="Ej: Lote"
                    onChange={(e) => set({ etiquetaFila: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Mínimo</label>
                    <input type="number" min={0} className="input" value={campo.minFilas ?? ''}
                      onChange={(e) => set({ minFilas: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="label">Máximo</label>
                    <input type="number" min={1} className="input" value={campo.maxFilas ?? ''}
                      onChange={(e) => set({ maxFilas: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Selecciona el grupo y agrega sus campos desde la paleta de la izquierda.</p>
              </>
            )}
          </>
        )}

        {actual === 'opciones' && (
          <EditorOpciones opciones={campo.opciones ?? []} onChange={(opciones) => set({ opciones })} publicadas={opcionesPublicadas} />
        )}

        {actual === 'formula' && (
          <EditorFormula campo={campo} onChange={(formula) => set({ formula })} referencias={referencias} />
        )}

        {actual === 'condicion' && (
          campo.condicion ? (
            <EditorCondicion condicion={campo.condicion} onChange={(condicion) => set({ condicion })}
              campos={referencias.filter((r) => !r.key.includes('.'))} />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Sin condición: el campo siempre se muestra.</p>
              <button className="btn-secondary w-full"
                onClick={() => set({ condicion: { logica: 'y', reglas: [{ campo: '', operador: 'igual', valor: '' }] } })}>
                <Plus className="h-4 w-4" /> Mostrar solo si…
              </button>
            </div>
          )
        )}

        {actual === 'validacion' && (
          <EditorValidaciones campo={campo} onChange={(validaciones) => set({ validaciones })} />
        )}
      </div>
    </div>
  );
}
