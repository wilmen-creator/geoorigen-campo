// Inicio: botón de sincronizar y los formularios asignados.

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Settings, CloudUpload, WifiOff, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { ENLACE_DESCARGA, versionNueva } from '../lib/actualizacion.ts';
import { db, contarPendientes, type FormularioLocal } from '../lib/db.ts';
import { sincronizar, type ResultadoSync } from '../lib/sync.ts';
import { useSesion } from '../lib/sesion.tsx';

const CLAVE_ULTIMA = 'geoorigen.app.ultima_sync';

export function Inicio({ onFormulario, onAjustes }: { onFormulario: (f: FormularioLocal) => void; onAjustes: () => void }) {
  const { org, sesion, recargarMembresias } = useSesion();
  const [formularios, setFormularios] = useState<FormularioLocal[]>([]);
  const [conteos, setConteos] = useState<Map<string, { total: number; pendientes: number }>>(new Map());
  const [pendientes, setPendientes] = useState({ registros: 0, archivos: 0 });
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSync | null>(null);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [ultima, setUltima] = useState(() => { try { return localStorage.getItem(CLAVE_ULTIMA); } catch { return null; } });

  const cargar = useCallback(async () => {
    if (!org) return;
    const fs = (await db.formularios.where({ org_id: org.org_id }).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    setFormularios(fs);
    const regs = await db.registros.where({ org_id: org.org_id }).toArray();
    const m = new Map<string, { total: number; pendientes: number }>();
    for (const r of regs) {
      const c = m.get(r.formulario_id) ?? { total: 0, pendientes: 0 };
      c.total++;
      if (r.pendiente) c.pendientes++;
      m.set(r.formulario_id, c);
    }
    setConteos(m);
    setPendientes(await contarPendientes(org.org_id));
  }, [org]);

  useEffect(() => { cargar(); }, [cargar]);
  const [nueva, setNueva] = useState<string | null>(null);
  useEffect(() => { versionNueva().then(setNueva); }, []);
  useEffect(() => {
    const on = () => setEnLinea(true), off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const sincronizarTodo = async () => {
    if (!org) return;
    setSincronizando(true);
    setResultado(null);
    await recargarMembresias();
    const r = await sincronizar(org.org_id);
    setResultado(r);
    setSincronizando(false);
    if (r.errores.length === 0) {
      const ahora = new Date().toISOString();
      setUltima(ahora);
      try { localStorage.setItem(CLAVE_ULTIMA, ahora); } catch { /* sin almacenamiento */ }
    }
    cargar();
  };

  const totalPendiente = pendientes.registros + pendientes.archivos;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between bg-primary px-4 py-4 text-white">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{org?.nombre}</h1>
          <p className="truncate text-xs opacity-80">{sesion?.user.email?.replace('@sin-correo.geoorigen.com', '')}</p>
        </div>
        <button onClick={onAjustes} className="rounded-lg p-2 active:bg-white/20" aria-label="Ajustes"><Settings className="h-6 w-6" /></button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {nueva && (
          <a href={ENLACE_DESCARGA} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-primary bg-primary-light px-3 py-3 text-primary">
            <Download className="h-6 w-6 shrink-0" />
            <span className="text-sm">
              <strong>Hay una versión nueva ({nueva}).</strong> Sincroniza primero y luego toca aquí para descargarla e instalarla.
            </span>
          </a>
        )}
        <button className="btn-primario w-full py-4 text-lg" onClick={sincronizarTodo} disabled={sincronizando || !enLinea}>
          {!enLinea ? <><WifiOff className="h-5 w-5" /> Sin señal</> : (
            <><RefreshCw className={`h-5 w-5 ${sincronizando ? 'animate-spin' : ''}`} /> {sincronizando ? 'Sincronizando…' : 'Sincronizar'}</>
          )}
        </button>
        <p className="-mt-2 text-center text-xs text-gray-500">
          {totalPendiente > 0
            ? <span className="inline-flex items-center gap-1 text-accent"><CloudUpload className="h-3.5 w-3.5" /> {pendientes.registros} encuesta(s) y {pendientes.archivos} foto(s) por subir</span>
            : 'Todo está subido'}
          {ultima && <span className="block">Última sincronización: {new Date(ultima).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>}
        </p>

        {resultado && (
          <div className={`rounded-xl px-3 py-2 text-sm ${resultado.errores.length ? 'bg-red-50 text-red-700' : 'bg-primary-light text-primary'}`}>
            {resultado.errores.length === 0 ? (
              <p className="flex items-center gap-1 font-medium"><CheckCircle2 className="h-4 w-4" /> Listo</p>
            ) : (
              <p className="flex items-center gap-1 font-medium"><AlertTriangle className="h-4 w-4" /> Se sincronizó con problemas</p>
            )}
            <p className="text-xs">
              Subidas: {resultado.subidas} encuesta(s), {resultado.fotos} foto(s) · Formularios: {resultado.formularios}
              {resultado.actualizadas > 0 && ` · ${resultado.actualizadas} encuesta(s) con cambios del revisor`}
            </p>
            {resultado.errores.slice(0, 4).map((e, i) => <p key={i} className="text-xs">• {e}</p>)}
          </div>
        )}

        <h2 className="pt-2 text-sm font-semibold text-gray-500 uppercase">Formularios</h2>
        {formularios.length === 0 ? (
          <p className="tarjeta text-center text-sm text-gray-500">
            {ultima ? 'No tienes formularios asignados.' : 'Toca "Sincronizar" para descargar tus formularios.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {formularios.map((f) => {
              const c = conteos.get(f.id);
              return (
                <button key={f.id} onClick={() => onFormulario(f)} className="tarjeta flex flex-col items-start gap-1 text-left active:bg-geo-gray">
                  <span className="text-3xl">{f.icono}</span>
                  <span className="font-semibold leading-tight">{f.nombre}</span>
                  <span className="text-xs text-gray-500">{c?.total ?? 0} encuesta(s)</span>
                  {!!c?.pendientes && <span className="text-xs text-accent">{c.pendientes} por subir</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
