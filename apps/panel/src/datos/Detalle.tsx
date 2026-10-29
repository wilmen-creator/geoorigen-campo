// Panel lateral con el detalle de un registro.

import { useEffect, useState } from 'react';
import { X, AlertTriangle, MapPin, Clock, Smartphone, History } from 'lucide-react';
import type { Campo, Esquema, Fila } from '@geoorigen/motor';
import { supabase, mensajeError } from '../lib/supabase.ts';
import { ALERTAS, tituloRegistro, valorComoTexto, type RegistroPanel } from './registros.ts';
import { COLOR_ESTADO } from './Mapa.tsx';

interface Estado { valor: string; etiqueta: string; color: string }
interface Archivo { id: string; campo_key: string; tipo: string; origen: string; storage_path: string; tomada_en: string | null; exif: Record<string, unknown>; url?: string }
interface Cambio { revision: number; estado: string; cambiado_en: string; cambiado_por: string | null }

const fecha = (t: string | null | undefined) =>
  t ? new Date(t).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function Respuesta({ campo, valor }: { campo: Campo; valor: unknown }) {
  if (campo.tipo === 'separador') return <p className="pt-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">{campo.etiqueta}</p>;
  if (campo.tipo === 'instruccion') return null;
  if (campo.tipo === 'repetible') {
    const filas = (Array.isArray(valor) ? valor : []) as Fila[];
    const hijos = (campo.campos ?? []).filter((h) => !['separador', 'instruccion'].includes(h.tipo));
    return (
      <div>
        <p className="text-xs text-gray-500">{campo.etiqueta} ({filas.length})</p>
        {filas.length > 0 && (
          <div className="mt-1 overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-xs">
              <thead className="bg-geo-gray text-left text-gray-500">
                <tr><th className="px-2 py-1">#</th>{hijos.map((h) => <th key={h.key} className="px-2 py-1 font-medium">{h.etiqueta}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filas.map((f, i) => (
                  <tr key={i}><td className="px-2 py-1 text-gray-400">{i + 1}</td>
                    {hijos.map((h) => <td key={h.key} className="px-2 py-1">{valorComoTexto(h, f[h.key]) || '—'}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
  const texto = valorComoTexto(campo, valor as never);
  return (
    <div className="grid grid-cols-5 gap-2 text-sm">
      <span className="col-span-2 text-gray-500">{campo.etiqueta}</span>
      <span className={`col-span-3 ${texto ? '' : 'text-gray-300'}`}>{texto || '—'}</span>
    </div>
  );
}

export function Detalle({ registro, esquemaVersion, estados, puedeCambiarEstado, onCerrar, onCambio }: {
  registro: RegistroPanel;
  /** Esquema de la versión con la que se capturó este registro */
  esquemaVersion: Esquema | null;
  estados: Estado[];
  puedeCambiarEstado: boolean;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [historial, setHistorial] = useState<Cambio[]>([]);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState('');
  const { titulo, subtitulo } = tituloRegistro(registro, esquemaVersion);

  useEffect(() => {
    (async () => {
      const [{ data: as }, { data: hs }] = await Promise.all([
        supabase.from('archivos').select('id, campo_key, tipo, origen, storage_path, tomada_en, exif').eq('registro_id', registro.id),
        supabase.from('registros_historial').select('revision, estado, cambiado_en, cambiado_por').eq('registro_id', registro.id).order('revision', { ascending: false }),
      ]);
      // Solo los que usa la encuesta (versiones anteriores de la app subían firmas reemplazadas)
      const usados = JSON.stringify(registro.datos);
      const lista = ((as ?? []) as Archivo[]).filter((a) => usados.includes(a.id));
      if (lista.length) {
        // Enlaces privados de 1 hora: el bucket no es público
        const { data: urls } = await supabase.storage.from('campo-archivos').createSignedUrls(lista.map((a) => a.storage_path), 3600);
        lista.forEach((a, i) => { a.url = urls?.[i]?.signedUrl ?? undefined; });
      }
      setArchivos(lista);
      const cambios = (hs ?? []) as Cambio[];
      setHistorial(cambios);
      const ids = [...new Set(cambios.map((c) => c.cambiado_por).filter(Boolean))] as string[];
      if (ids.length) {
        const { data: ps } = await supabase.from('perfiles').select('user_id, nombre, email').in('user_id', ids);
        setNombres(new Map((ps ?? []).map((p) => [p.user_id, p.nombre || p.email])));
      }
    })();
  }, [registro.id, registro.revision]);

  const cambiarEstado = async (estado: string) => {
    setError('');
    const { error: err } = await supabase.from('registros').update({ estado }).eq('id', registro.id);
    if (err) return setError(mensajeError(err));
    onCambio();
  };

  const tieneControl = registro.alertas.length > 0 || registro.distancia_finca_m != null || registro.duracion_s != null;

  return (
    <aside className="flex h-full w-full flex-col border-l border-gray-100 bg-white md:w-[440px]">
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{titulo}</p>
          <p className="truncate text-xs text-gray-400">{subtitulo || `v${registro.formulario_version} · revisión ${registro.revision}`}</p>
        </div>
        <button className="btn-icon" onClick={onCerrar}><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Estado</span>
          {puedeCambiarEstado ? (
            <select className="input w-auto py-1" value={registro.estado} onChange={(e) => cambiarEstado(e.target.value)}
              style={{ borderColor: COLOR_ESTADO[registro.estado] }}>
              {estados.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
            </select>
          ) : (
            <span className="badge text-white" style={{ background: COLOR_ESTADO[registro.estado] ?? '#6b7280' }}>{registro.estado}</span>
          )}
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="space-y-1 text-sm">
          <p><span className="text-gray-500">Técnico:</span> {registro.tecnico_nombre || registro.tecnico_email || '—'}</p>
          <p><span className="text-gray-500">Inició:</span> {fecha(registro.captura_inicio_en ?? registro.creado_en)}</p>
          <p><span className="text-gray-500">Recibido:</span> {fecha(registro.recibido_en)}</p>
        </div>

        {tieneControl && (
          <div className="space-y-2 rounded-xl border border-gray-100 bg-geo-gray p-3 text-sm">
            <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Control de veracidad</p>
            {registro.alertas.length === 0 ? (
              <p className="text-primary">✓ Sin alertas</p>
            ) : registro.alertas.map((a) => (
              <p key={a} className="flex items-start gap-1.5 text-red-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span><strong>{ALERTAS[a]?.texto ?? a}:</strong> {ALERTAS[a]?.detalle}</span>
              </p>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-gray-600">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> A la finca: {registro.distancia_finca_m != null ? `${Math.round(registro.distancia_finca_m)} m` : '—'}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Llenado: {registro.duracion_s != null ? `${Math.round(registro.duracion_s / 60)} min` : '—'}</span>
              <span>Precisión GPS: {registro.captura_inicio_precision != null ? `${Math.round(registro.captura_inicio_precision)} m` : '—'}</span>
              <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> {String(registro.dispositivo?.modelo ?? '—')}</span>
            </div>
            {registro.captura_lat != null && (
              <a className="text-xs text-primary hover:underline" target="_blank" rel="noreferrer"
                href={`https://www.google.com/maps?q=${registro.captura_lat},${registro.captura_lon}`}>
                Ver punto de captura en Google Maps ↗
              </a>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Respuestas</p>
          {esquemaVersion ? esquemaVersion.secciones.map((s) => (
            <div key={s.id} className="space-y-1.5">
              <p className="border-b border-gray-100 pb-1 text-sm font-semibold">{s.titulo}</p>
              {s.campos.map((c) => <Respuesta key={c.key} campo={c} valor={registro.datos[c.key]} />)}
            </div>
          )) : <p className="text-sm text-gray-400">Cargando formulario…</p>}
        </div>

        {archivos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Fotos y firmas</p>
            <div className="grid grid-cols-3 gap-2">
              {archivos.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-lg border border-gray-100">
                  {a.url ? <img src={a.url} alt={a.campo_key} className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-geo-gray" />}
                  {a.origen === 'galeria' && (
                    <span className="absolute top-1 left-1 rounded bg-amber-500 px-1 text-[10px] text-white" title={`Fecha original: ${fecha(a.tomada_en)}`}>📁 galería</span>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}

        {historial.length > 0 && (
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-xs font-semibold tracking-wide text-gray-500 uppercase"><History className="h-3 w-3" /> Historial</p>
            {historial.map((h) => (
              <p key={h.revision} className="text-xs text-gray-500">
                Revisión {h.revision} · {h.estado} · {fecha(h.cambiado_en)} · {nombres.get(h.cambiado_por ?? '') ?? '—'}
              </p>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
