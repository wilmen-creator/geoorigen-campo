// Campos de una encuesta en el celular. Usan el motor compartido para
// condiciones y cálculos, igual que la vista previa del panel.

import { useEffect, useState, type ReactNode } from 'react';
import { Camera as IconoCamara, ImagePlus, MapPin, Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { camposVisibles, type Campo, type Contexto, type Fila, type Ubicacion, type Valor } from '@geoorigen/motor';
import { tomarPunto } from '../lib/gps.ts';
import { tomarFoto, borrarArchivo, guardarFirma, urlArchivo } from '../lib/fotos.ts';
import { db } from '../lib/db.ts';
import { SignatureCanvas } from '../Firma.tsx';

export interface ContextoCampo {
  registroId: string;
  orgId: string;
  soloLectura: boolean;
  /** Claves con error de validación (ruta completa, p. ej. 'parcelas[2].variedad') */
  errores: Set<string>;
}

function Etiqueta({ campo, error }: { campo: Campo; error: boolean }) {
  return (
    <span className={`etiqueta ${error ? 'text-red-600' : ''}`}>
      {campo.etiqueta}{campo.obligatorio && <span className="text-red-500"> *</span>}
    </span>
  );
}

const Ayuda = ({ campo }: { campo: Campo }) =>
  campo.ayuda && campo.tipo !== 'instruccion' ? <p className="mt-1 text-xs text-gray-500">{campo.ayuda}</p> : null;

// ── GPS ───────────────────────────────────────────────────────────────────────

function CampoGPS({ valor, onChange, soloLectura }: { valor: Valor; onChange: (v: Valor) => void; soloLectura: boolean }) {
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const u = valor && typeof valor === 'object' && 'lat' in valor ? (valor as Ubicacion) : null;
  const tomar = async () => {
    setBuscando(true);
    setError('');
    const p = await tomarPunto();
    setBuscando(false);
    if (!p) return setError('No se pudo obtener el GPS. Revisa que la ubicación esté encendida y con permiso.');
    onChange({ lat: p.lat, lon: p.lon, precision: p.precision, en: p.en });
  };
  return (
    <div className="space-y-2">
      {u && (
        <div className="rounded-xl bg-primary-light px-3 py-2 text-sm text-primary">
          📍 {u.lat.toFixed(6)}, {u.lon.toFixed(6)}
          {u.precision != null && <span className="text-xs"> · ±{Math.round(u.precision)} m</span>}
        </div>
      )}
      {!soloLectura && (
        <button type="button" className="btn-secundario w-full" onClick={tomar} disabled={buscando}>
          <MapPin className="h-5 w-5" /> {buscando ? 'Buscando señal GPS…' : u ? 'Volver a tomar ubicación' : 'Tomar ubicación'}
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ── Fotos ─────────────────────────────────────────────────────────────────────

function Miniatura({ id, onQuitar }: { id: string; onQuitar?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [galeria, setGaleria] = useState(false);
  useEffect(() => {
    urlArchivo(id).then(setUrl);
    db.archivos.get(id).then((a) => setGaleria(a?.origen === 'galeria'));
  }, [id]);
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl bg-geo-gray">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-gray-400">Foto en el servidor</span>}
      {galeria && <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white">galería</span>}
      {onQuitar && (
        <button type="button" onClick={onQuitar} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function CampoFotos({ campo, valor, onChange, ctx }: { campo: Campo; valor: Valor; onChange: (v: Valor) => void; ctx: ContextoCampo }) {
  const ids = Array.isArray(valor) ? (valor as string[]) : [];
  const max = campo.maxFotos ?? 5;
  const [ocupado, setOcupado] = useState(false);
  const agregar = async (desdeGaleria: boolean) => {
    setOcupado(true);
    const a = await tomarFoto({ desdeGaleria, registroId: ctx.registroId, orgId: ctx.orgId, campoKey: campo.key });
    setOcupado(false);
    if (a) onChange([...ids, a.id]);
  };
  return (
    <div className="space-y-2">
      {ids.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {ids.map((id) => (
            <Miniatura key={id} id={id}
              onQuitar={ctx.soloLectura ? undefined : () => { borrarArchivo(id); onChange(ids.filter((x) => x !== id)); }} />
          ))}
        </div>
      )}
      {!ctx.soloLectura && ids.length < max && (
        <div className="flex gap-2">
          <button type="button" className="btn-secundario flex-1" disabled={ocupado} onClick={() => agregar(false)}>
            <IconoCamara className="h-5 w-5" /> Cámara
          </button>
          {campo.permitirGaleria !== false && (
            <button type="button" className="btn-secundario flex-1" disabled={ocupado} onClick={() => agregar(true)}>
              <ImagePlus className="h-5 w-5" /> Galería
            </button>
          )}
        </div>
      )}
      <p className="text-xs text-gray-400">{ids.length} de {max} fotos</p>
    </div>
  );
}

// ── Firma ─────────────────────────────────────────────────────────────────────

function CampoFirma({ campo, valor, onChange, ctx }: { campo: Campo; valor: Valor; onChange: (v: Valor) => void; ctx: ContextoCampo }) {
  const id = typeof valor === 'string' ? valor : '';
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) { setDataUrl(''); return; }
    db.archivos.get(id).then((a) => {
      if (!a) return setDataUrl('');
      const r = new FileReader();
      r.onload = () => setDataUrl(String(r.result));
      r.readAsDataURL(a.datos);
    });
  }, [id]);
  if (dataUrl === null) return null;
  return (
    <SignatureCanvas
      value={dataUrl}
      disabled={ctx.soloLectura}
      onChange={async (b64) => {
        if (!b64) { if (id) await borrarArchivo(id); onChange(''); return; }
        onChange(await guardarFirma({ dataUrl: b64, registroId: ctx.registroId, orgId: ctx.orgId, campoKey: campo.key, anteriorId: id || undefined }));
      }}
    />
  );
}

// ── Grupo repetible ───────────────────────────────────────────────────────────

function Grupo({ campo, ctx, contexto, ruta, onChange }: {
  campo: Campo; ctx: ContextoCampo; contexto: Contexto; ruta: string; onChange: (v: Valor) => void;
}) {
  const filas = (Array.isArray(contexto[contexto.length - 1][campo.key]) ? contexto[contexto.length - 1][campo.key] : []) as Fila[];
  const [abierta, setAbierta] = useState<number | null>(filas.length ? null : 0);
  const nombre = campo.etiquetaFila || 'Fila';
  const max = campo.maxFilas ?? 50;
  const conError = (i: number) => [...ctx.errores].some((e) => e.startsWith(`${ruta}[${i + 1}]`));

  return (
    <div className="space-y-2">
      {filas.map((fila, i) => {
        const ctxFila = [...contexto, fila];
        const resumen = Object.values(fila).find((v) => typeof v === 'string' && v) as string | undefined;
        return (
          <div key={i} className={`rounded-xl border ${conError(i) ? 'border-red-300' : 'border-gray-200'} bg-white`}>
            <button type="button" className="flex w-full items-center justify-between px-3 py-3 text-left" onClick={() => setAbierta(abierta === i ? null : i)}>
              <span className="font-medium">{nombre} {i + 1}{resumen && <span className="ml-2 text-sm font-normal text-gray-500">{resumen}</span>}</span>
              {abierta === i ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </button>
            {abierta === i && (
              <div className="space-y-4 border-t border-gray-100 p-3">
                {camposVisibles(campo.campos ?? [], ctxFila).map((h) => (
                  <CampoApp key={h.key} campo={h} ctx={ctx} contexto={ctxFila} ruta={`${ruta}[${i + 1}].${h.key}`}
                    onChange={(v) => onChange(filas.map((f, j) => (j === i ? { ...f, [h.key]: v } : f)))} />
                ))}
                {!ctx.soloLectura && (
                  <button type="button" className="flex items-center gap-1 text-sm text-red-600"
                    onClick={() => { if (confirm(`¿Quitar ${nombre.toLowerCase()} ${i + 1}?`)) { onChange(filas.filter((_, j) => j !== i)); setAbierta(null); } }}>
                    <Trash2 className="h-4 w-4" /> Quitar {nombre.toLowerCase()}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {!ctx.soloLectura && filas.length < max && (
        <button type="button" className="btn-secundario w-full" onClick={() => { onChange([...filas, {}]); setAbierta(filas.length); }}>
          <Plus className="h-5 w-5" /> Agregar {nombre.toLowerCase()}
        </button>
      )}
    </div>
  );
}

// ── Un campo cualquiera ───────────────────────────────────────────────────────

export function CampoApp({ campo, ctx, contexto, ruta, onChange }: {
  campo: Campo; ctx: ContextoCampo; contexto: Contexto; ruta: string; onChange: (v: Valor) => void;
}) {
  const valores = contexto[contexto.length - 1];
  const v = valores[campo.key] ?? (campo.valorDefecto && !ctx.soloLectura ? campo.valorDefecto : undefined);
  const texto = typeof v === 'string' ? v : '';
  const error = ctx.errores.has(ruta);
  const ro = ctx.soloLectura;
  const marco = (contenido: ReactNode) => (
    <div className={error ? 'rounded-xl bg-red-50 p-2 -m-2' : ''}>
      <Etiqueta campo={campo} error={error} />
      {contenido}
      <Ayuda campo={campo} />
    </div>
  );

  switch (campo.tipo) {
    case 'separador':
      return <h3 className="border-b border-gray-200 pb-1 pt-2 font-semibold">{campo.etiqueta}</h3>;
    case 'instruccion':
      return <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">{campo.ayuda || campo.etiqueta}</div>;
    case 'calculado':
      return marco(<div className="entrada bg-geo-gray font-semibold text-primary">{texto || '—'}</div>);
    case 'gps':
      return marco(<CampoGPS valor={v ?? null} onChange={onChange} soloLectura={ro} />);
    case 'foto':
      return marco(<CampoFotos campo={campo} valor={v ?? null} onChange={onChange} ctx={ctx} />);
    case 'firma':
      return marco(<CampoFirma campo={campo} valor={v ?? null} onChange={onChange} ctx={ctx} />);
    case 'repetible':
      return marco(<Grupo campo={campo} ctx={ctx} contexto={contexto} ruta={ruta} onChange={onChange} />);
    case 'sino':
      return marco(
        <div className="flex gap-2">
          {[['Si', 'Sí'], ['No', 'No']].map(([val, et]) => (
            <button key={val} type="button" disabled={ro} onClick={() => onChange(texto === val ? '' : val)}
              className={`flex-1 rounded-xl border py-3 font-medium ${texto === val ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white'}`}>
              {et}
            </button>
          ))}
        </div>,
      );
    case 'radio':
      return marco(
        <div className="space-y-2">
          {(campo.opciones ?? []).map((o) => (
            <button key={o.valor} type="button" disabled={ro} onClick={() => onChange(o.valor)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left ${texto === o.valor ? 'border-primary bg-primary-light' : 'border-gray-200 bg-white'}`}>
              <span className={`h-5 w-5 rounded-full border-2 ${texto === o.valor ? 'border-primary bg-primary' : 'border-gray-300'}`} />
              {o.etiqueta}
            </button>
          ))}
        </div>,
      );
    case 'checkbox': {
      const marcadas = Array.isArray(v) ? (v as string[]) : [];
      return marco(
        <div className="space-y-2">
          {(campo.opciones ?? []).map((o) => {
            const si = marcadas.includes(o.valor);
            return (
              <button key={o.valor} type="button" disabled={ro}
                onClick={() => onChange(si ? marcadas.filter((x) => x !== o.valor) : [...marcadas, o.valor])}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left ${si ? 'border-primary bg-primary-light' : 'border-gray-200 bg-white'}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded border-2 text-xs text-white ${si ? 'border-primary bg-primary' : 'border-gray-300'}`}>{si && '✓'}</span>
                {o.etiqueta}
              </button>
            );
          })}
        </div>,
      );
    }
    case 'select':
      return marco(
        <select className="entrada" disabled={ro} value={texto} onChange={(e) => onChange(e.target.value)}>
          <option value="">Seleccionar…</option>
          {(campo.opciones ?? []).map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </select>,
      );
    case 'calificacion':
      return marco(
        <div className="flex gap-1">
          {Array.from({ length: campo.estrellas ?? 5 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" disabled={ro} onClick={() => onChange(String(n))}
              className={`text-3xl ${Number(texto) >= n ? 'text-amber-400' : 'text-gray-300'}`}>★</button>
          ))}
        </div>,
      );
    case 'parrafo':
      return marco(<textarea className="entrada" rows={4} disabled={ro} value={texto} placeholder={campo.placeholder} onChange={(e) => onChange(e.target.value)} />);
    default: {
      const tipo = { fecha: 'date', hora: 'time', email: 'email', tel: 'tel' }[campo.tipo as string] ?? 'text';
      const numerico = campo.tipo === 'numero' || campo.tipo === 'decimal';
      return marco(
        <input className="entrada" type={tipo} disabled={ro} value={texto} placeholder={campo.placeholder}
          inputMode={campo.tipo === 'numero' ? 'numeric' : campo.tipo === 'decimal' ? 'decimal' : campo.tipo === 'tel' ? 'tel' : undefined}
          onChange={(e) => onChange(numerico ? e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') : e.target.value)} />,
      );
    }
  }
}
