// Inicio: botón de sincronizar y los formularios asignados.

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Settings, CloudUpload, WifiOff, CheckCircle2, AlertTriangle, Download, ChevronRight } from 'lucide-react';
import { ENLACE_DESCARGA, versionNueva } from '../lib/actualizacion.ts';
import { db, contarPendientes, esDe, porSubir, normalizar, type FormularioLocal } from '../lib/db.ts';
import { sincronizar, type ResultadoSync } from '../lib/sync.ts';
import { useSesion } from '../lib/sesion.tsx';

const CLAVE_ULTIMA = 'geoorigen.app.ultima_sync';

export function Inicio({ onFormulario, onAjustes }: { onFormulario: (f: FormularioLocal) => void; onAjustes: () => void }) {
  const { org, sesion, recargarMembresias } = useSesion();
  const [formularios, setFormularios] = useState<FormularioLocal[]>([]);
  const [conteos, setConteos] = useState<Map<string, { total: number; pendientes: number }>>(new Map());
  const [pendientes, setPendientes] = useState({ registros: 0, incompletas: 0, archivos: 0 });
  const [sincronizando, setSincronizando] = useState(false);
  const [avance, setAvance] = useState('');
  const [filtro, setFiltro] = useState('');
  const [resultado, setResultado] = useState<ResultadoSync | null>(null);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [ultima, setUltima] = useState(() => { try { return localStorage.getItem(CLAVE_ULTIMA); } catch { return null; } });

  const cargar = useCallback(async () => {
    if (!org) return;
    const fs = (await db.formularios.where({ org_id: org.org_id }).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    setFormularios(fs);
    const regs = (await db.registros.where({ org_id: org.org_id }).toArray()).filter((r) => esDe(r, sesion?.user.id));
    const m = new Map<string, { total: number; pendientes: number }>();
    for (const r of regs) {
      const c = m.get(r.formulario_id) ?? { total: 0, pendientes: 0 };
      c.total++;
      if (porSubir(r)) c.pendientes++;
      m.set(r.formulario_id, c);
    }
    setConteos(m);
    setPendientes(await contarPendientes(org.org_id, sesion?.user.id));
  }, [org, sesion]);

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
    let r: ResultadoSync;
    try {
      await recargarMembresias();
      r = await sincronizar(org.org_id, sesion?.user.id, setAvance);
    } catch (e) {
      r = { subidas: 0, fotos: 0, formularios: 0, actualizadas: 0, errores: [(e as Error).message] };
    } finally {
      setSincronizando(false);
      setAvance('');
    }
    setResultado(r);
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
            <><RefreshCw className={`h-5 w-5 ${sincronizando ? 'animate-spin' : ''}`} /> {sincronizando ? (avance || 'Sincronizando…') : 'Sincronizar'}</>
          )}
        </button>
        <p className="-mt-2 text-center text-xs text-gray-500">
          {totalPendiente > 0
            ? <span className="inline-flex items-center gap-1 text-accent"><CloudUpload className="h-3.5 w-3.5" /> {pendientes.registros} encuesta(s) y {pendientes.archivos} foto(s) por subir</span>
            : 'Todo está subido'}
          {pendientes.incompletas > 0 && (
            <span className="block">{pendientes.incompletas} encuesta(s) sin terminar: se suben cuando las envíes</span>
          )}
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
            {resultado.errores.length > 0 && (
              <p className="mt-1 text-xs font-medium">Lo que no subió sigue guardado en este celular. Vuelve a sincronizar cuando tengas mejor señal.</p>
            )}
          </div>
        )}

        <h2 className="pt-2 text-sm font-semibold text-gray-500 uppercase">Formularios</h2>
        {formularios.length === 0 ? (
          <p className="tarjeta text-center text-sm text-gray-500">
            {ultima ? 'No tienes formularios asignados.' : 'Toca "Sincronizar" para descargar tus formularios.'}
          </p>
        ) : (
          <>
            {formularios.length > 6 && (
              <input className="input" type="search" placeholder="Buscar formulario…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
            )}
            <div className="tarjeta divide-y divide-gray-100 p-0">
              {formularios.filter((f) => normalizar(f.nombre).includes(normalizar(filtro))).map((f) => {
                const c = conteos.get(f.id);
                return (
                  <button key={f.id} onClick={() => onFormulario(f)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-geo-gray">
                    <span className="min-w-0 flex-1 truncate font-semibold">{f.nombre}</span>
                    <span className="shrink-0 text-xs text-gray-500">{c?.total ?? 0}</span>
                    {c?.pendientes
                      ? <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-accent"><CloudUpload className="h-4 w-4" />{c.pendientes}</span>
                      : <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-label="Todo subido" />}
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
