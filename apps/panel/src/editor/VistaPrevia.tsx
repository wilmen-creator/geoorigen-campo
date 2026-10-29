// Vista previa del formulario con el mismo motor que usa la app:
// condiciones, cálculos y validaciones se comportan igual que en el celular.

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  calcularDerivados, camposVisibles, seccionesVisibles, validarRegistro,
  type Campo, type Contexto, type Esquema, type Fila, type Valor, type Valores, type ErrorValidacion,
} from '@geoorigen/motor';

function CampoVista({ campo, ctx, onChange }: { campo: Campo; ctx: Contexto; onChange: (v: Valor) => void }) {
  const valores = ctx[ctx.length - 1];
  const v = valores[campo.key];
  const texto = typeof v === 'string' ? v : '';
  const ancho = campo.ancho === 'medio' ? '' : 'col-span-2';
  const etiqueta = (
    <label className="label normal-case">
      {campo.etiqueta}{campo.obligatorio && <span className="text-red-500"> *</span>}
    </label>
  );
  const ayuda = campo.ayuda && campo.tipo !== 'instruccion' ? <p className="mt-0.5 text-xs text-gray-400">{campo.ayuda}</p> : null;

  switch (campo.tipo) {
    case 'separador':
      return <div className="col-span-2 border-b border-gray-200 pb-1 font-semibold">{campo.etiqueta}</div>;
    case 'instruccion':
      return <div className="col-span-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{campo.ayuda || campo.etiqueta}</div>;
    case 'calculado':
      return (
        <div className={ancho}>{etiqueta}
          <div className="input bg-geo-gray font-medium text-primary">{texto || '—'}</div>
        </div>
      );
    case 'gps': case 'foto': case 'firma': case 'qr':
      return (
        <div className="col-span-2">{etiqueta}
          <div className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-center text-xs text-gray-400">
            {campo.tipo === 'gps' ? '📍 Captura de GPS' : campo.tipo === 'foto' ? `📷 Hasta ${campo.maxFotos ?? 5} fotos`
              : campo.tipo === 'qr' ? `▣ Escanear QR del productor · trae: ${(campo.traeQR ?? []).join(', ') || 'nada (elige los datos)'}` : '✍ Firma'} · solo en la app
          </div>{ayuda}
        </div>
      );
    case 'sino':
      return (
        <div className={ancho}>{etiqueta}
          <div className="flex gap-2">
            {['Si', 'No'].map((o) => (
              <button key={o} onClick={() => onChange(texto === o ? '' : o)}
                className={`flex-1 rounded-lg border py-2 text-sm ${texto === o ? 'border-primary bg-primary text-white' : 'border-gray-200'}`}>
                {o === 'Si' ? 'Sí' : 'No'}
              </button>
            ))}
          </div>{ayuda}
        </div>
      );
    case 'select':
      return (
        <div className={ancho}>{etiqueta}
          <select className="input" value={texto} onChange={(e) => onChange(e.target.value)}>
            <option value="">Seleccionar…</option>
            {(campo.opciones ?? []).map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
          </select>{ayuda}
        </div>
      );
    case 'radio':
      return (
        <div className={ancho}>{etiqueta}
          <div className="space-y-1">
            {(campo.opciones ?? []).map((o) => (
              <label key={o.valor} className="flex items-center gap-2 text-sm">
                <input type="radio" className="accent-primary" checked={texto === o.valor} onChange={() => onChange(o.valor)} />
                {o.etiqueta}
              </label>
            ))}
          </div>{ayuda}
        </div>
      );
    case 'checkbox': {
      const marcadas = Array.isArray(v) ? (v as string[]) : [];
      return (
        <div className={ancho}>{etiqueta}
          <div className="space-y-1">
            {(campo.opciones ?? []).map((o) => (
              <label key={o.valor} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={marcadas.includes(o.valor)}
                  onChange={(e) => onChange(e.target.checked ? [...marcadas, o.valor] : marcadas.filter((x) => x !== o.valor))} />
                {o.etiqueta}
              </label>
            ))}
          </div>{ayuda}
        </div>
      );
    }
    case 'calificacion':
      return (
        <div className={ancho}>{etiqueta}
          <div className="flex gap-1">
            {Array.from({ length: campo.estrellas ?? 5 }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => onChange(String(n))}
                className={`text-2xl ${Number(texto) >= n ? 'text-amber-400' : 'text-gray-200'}`}>★</button>
            ))}
          </div>
        </div>
      );
    case 'parrafo':
      return (
        <div className="col-span-2">{etiqueta}
          <textarea className="input" rows={3} value={texto} placeholder={campo.placeholder} onChange={(e) => onChange(e.target.value)} />{ayuda}
        </div>
      );
    case 'repetible':
      return <GrupoVista campo={campo} ctx={ctx} onChange={onChange} />;
    default: {
      const tipo = { fecha: 'date', hora: 'time', email: 'email', tel: 'tel', numero: 'number', decimal: 'number' }[campo.tipo as string] ?? 'text';
      return (
        <div className={ancho}>{etiqueta}
          <input className="input" type={tipo} value={texto} placeholder={campo.placeholder}
            step={campo.tipo === 'decimal' ? 'any' : undefined} onChange={(e) => onChange(e.target.value)} />{ayuda}
        </div>
      );
    }
  }
}

function GrupoVista({ campo, ctx, onChange }: { campo: Campo; ctx: Contexto; onChange: (v: Valor) => void }) {
  const filas = (Array.isArray(ctx[ctx.length - 1][campo.key]) ? ctx[ctx.length - 1][campo.key] : []) as Fila[];
  const max = campo.maxFilas ?? Infinity;
  const nombreFila = campo.etiquetaFila || 'Fila';
  return (
    <div className="col-span-2 space-y-2">
      <p className="label normal-case">{campo.etiqueta}{campo.obligatorio && <span className="text-red-500"> *</span>}</p>
      {filas.map((fila, i) => {
        const ctxFila = [...ctx, fila];
        return (
          <div key={i} className="rounded-lg border border-gray-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{nombreFila} {i + 1}</p>
              <button className="btn-icon hover:text-red-600" onClick={() => onChange(filas.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {camposVisibles(campo.campos ?? [], ctxFila).map((h) => (
                <CampoVista key={h.key} campo={h} ctx={ctxFila}
                  onChange={(v) => onChange(filas.map((f, j) => (j === i ? { ...f, [h.key]: v } : f)))} />
              ))}
            </div>
          </div>
        );
      })}
      {filas.length < max && (
        <button className="btn-secondary w-full" onClick={() => onChange([...filas, {}])}>
          <Plus className="h-4 w-4" /> Agregar {nombreFila.toLowerCase()}
        </button>
      )}
    </div>
  );
}

export function VistaPrevia({ esquema, nombre }: { esquema: Esquema; nombre: string }) {
  const [crudos, setCrudos] = useState<Valores>({});
  const [errores, setErrores] = useState<ErrorValidacion[] | null>(null);
  const valores = useMemo(() => calcularDerivados(esquema, crudos), [esquema, crudos]);
  const secciones = seccionesVisibles(esquema, valores);
  const titulo = (k: string) => esquema.secciones.find((s) => s.id === k)?.titulo ?? '';

  return (
    <div className="h-full overflow-y-auto bg-geo-gray p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="card flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{nombre}</h2>
            <p className="text-xs text-gray-400">Vista previa · nada se guarda</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => { setCrudos({}); setErrores(null); }}>Limpiar</button>
            <button className="btn-primary" onClick={() => setErrores(validarRegistro(esquema, valores))}>Probar envío</button>
          </div>
        </div>

        {errores && (
          errores.length === 0 ? (
            <p className="rounded-lg bg-primary-light px-3 py-2 text-sm text-primary">✓ Se podría enviar: no falta nada.</p>
          ) : (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <p className="font-semibold">El colaborador vería {errores.length} pendiente(s):</p>
              <ul className="mt-1 list-disc pl-5">
                {errores.map((e, i) => <li key={i}><span className="text-red-400">{titulo(e.seccionId)} ›</span> {e.mensaje}</li>)}
              </ul>
            </div>
          )
        )}

        {secciones.map((s) => (
          <div key={s.id} className="card space-y-3">
            <div>
              <h3 className="font-semibold">{s.titulo}</h3>
              {s.descripcion && <p className="text-sm text-gray-400">{s.descripcion}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {camposVisibles(s.campos, [valores]).map((c) => (
                <CampoVista key={c.key} campo={c} ctx={[valores]} onChange={(v) => setCrudos((p) => ({ ...p, [c.key]: v }))} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
