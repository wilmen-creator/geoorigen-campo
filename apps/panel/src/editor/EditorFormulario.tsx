// Editor de formularios: paleta de campos, secciones, propiedades, vista previa,
// guardar borrador y publicar versión.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, ChevronDown, ChevronUp, Eye, EyeOff, Plus, Save, Send, Settings, Trash2, X, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { revisarEsquema, type Campo, type Esquema, type Problema, type Seccion, type TipoCampo } from '@geoorigen/motor';
import { supabase, mensajeError } from '../lib/supabase.ts';
import { puedeEditar, useSesion } from '../lib/sesion.tsx';
import { GRUPOS, TIPOS, campoNuevo, clavesUsadas, metaTipo, seccionNueva } from './catalogo.ts';
import { EditorCondicion, Propiedades, type CampoReferencia } from './Propiedades.tsx';
import { VistaPrevia } from './VistaPrevia.tsx';

/** Campo seleccionado: sección, campo y (si está dentro de un repetible) subcampo */
interface Sel { sec: number; campo: number; sub?: number }

interface Datos {
  nombre: string;
  descripcion: string;
  icono: string;
  esquema: Esquema;
  umbral_distancia_m: number;
  duracion_minima_s: number;
}

function normalizar(schema: unknown): Esquema {
  const e = (schema ?? {}) as Partial<Esquema>;
  return { version: 2, claveNombre: e.claveNombre ?? '', claveSubtitulo: e.claveSubtitulo ?? '',
    claveUbicacion: e.claveUbicacion, secciones: e.secciones ?? [] };
}

export function EditorFormulario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { org } = useSesion();
  const soloLectura = !puedeEditar(org?.rol);

  const [datos, setDatos] = useState<Datos | null>(null);
  const [guardado, setGuardado] = useState('');           // copia de lo último guardado, para saber si hay cambios
  const [versionActual, setVersionActual] = useState<number | null>(null);
  const [publicado, setPublicado] = useState<Esquema | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  const [selSec, setSelSec] = useState<number | null>(0);
  const [previa, setPrevia] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [problemas, setProblemas] = useState<Problema[] | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('formularios')
      .select('nombre, descripcion, icono, schema, version_actual, umbral_distancia_m, duracion_minima_s')
      .eq('id', id!)
      .single();
    if (error || !data) { navigate('/formularios'); return; }
    const d: Datos = {
      nombre: data.nombre, descripcion: data.descripcion ?? '', icono: data.icono ?? '📋',
      esquema: normalizar(data.schema),
      umbral_distancia_m: data.umbral_distancia_m, duracion_minima_s: data.duracion_minima_s,
    };
    setDatos(d);
    setGuardado(JSON.stringify(d));
    setVersionActual(data.version_actual);
    if (data.version_actual) {
      const { data: v } = await supabase.from('formulario_versiones').select('schema')
        .eq('formulario_id', id!).eq('version', data.version_actual).single();
      setPublicado(v ? normalizar(v.schema) : null);
    }
  }, [id, navigate]);

  useEffect(() => { cargar(); }, [cargar]);

  const hayCambios = datos !== null && JSON.stringify(datos) !== guardado;

  // Avisar antes de cerrar la pestaña con cambios sin guardar
  useEffect(() => {
    if (!hayCambios) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [hayCambios]);

  // Claves y opciones ya publicadas (cambiarlas separa los datos viejos de los nuevos)
  const publicadas = useMemo(() => {
    const claves = new Set<string>();
    const opciones = new Map<string, Set<string>>();
    const recorrer = (campos: Campo[], prefijo = '') => campos.forEach((c) => {
      claves.add(prefijo + c.key);
      opciones.set(prefijo + c.key, new Set((c.opciones ?? []).map((o) => o.valor)));
      recorrer(c.campos ?? [], `${c.key}.`);
    });
    publicado?.secciones.forEach((s) => recorrer(s.campos));
    return { claves, opciones };
  }, [publicado]);

  if (!datos) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary-light border-t-primary" />
      </div>
    );
  }

  const esquema = datos.esquema;
  const secciones = esquema.secciones;
  const setEsquema = (f: (e: Esquema) => Esquema) => setDatos((d) => (d ? { ...d, esquema: f(d.esquema) } : d));
  const setSecciones = (f: (s: Seccion[]) => Seccion[]) => setEsquema((e) => ({ ...e, secciones: f(e.secciones) }));
  const setSeccion = (i: number, cambio: Partial<Seccion>) =>
    setSecciones((ss) => ss.map((s, j) => (j === i ? { ...s, ...cambio } : s)));

  // ── Campo seleccionado ──────────────────────────────────────────────────────
  const campoDe = (s: Sel): Campo | undefined => {
    const c = secciones[s.sec]?.campos[s.campo];
    return s.sub === undefined ? c : c?.campos?.[s.sub];
  };
  const seleccionado = sel ? campoDe(sel) : undefined;
  const grupoSeleccionado = sel && sel.sub !== undefined ? secciones[sel.sec]?.campos[sel.campo] : undefined;

  const reemplazarCampo = (s: Sel, nuevo: Campo) =>
    setSecciones((ss) => ss.map((sec, i) => {
      if (i !== s.sec) return sec;
      return {
        ...sec,
        campos: sec.campos.map((c, j) => {
          if (j !== s.campo) return c;
          if (s.sub === undefined) return nuevo;
          return { ...c, campos: (c.campos ?? []).map((h, k) => (k === s.sub ? nuevo : h)) };
        }),
      };
    }));

  /** Mueve o quita un campo dentro de su lista (sección o grupo) */
  const editarLista = (s: Sel, f: (lista: Campo[], i: number) => Campo[]) =>
    setSecciones((ss) => ss.map((sec, i) => {
      if (i !== s.sec) return sec;
      if (s.sub === undefined) return { ...sec, campos: f(sec.campos, s.campo) };
      return { ...sec, campos: sec.campos.map((c, j) => (j === s.campo ? { ...c, campos: f(c.campos ?? [], s.sub!) } : c)) };
    }));

  const mover = (s: Sel, dir: -1 | 1) => {
    editarLista(s, (lista, i) => {
      const j = i + dir;
      if (j < 0 || j >= lista.length) return lista;
      const copia = [...lista];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
    setSel(s.sub === undefined ? { ...s, campo: s.campo + dir } : { ...s, sub: s.sub + dir });
  };

  const quitar = (s: Sel) => {
    const c = campoDe(s);
    if (c && publicadas.claves.has(c.key) && !confirm(`"${c.etiqueta}" ya está publicado. Si lo quitas, la app dejará de pedirlo (los datos viejos se conservan). ¿Quitar?`)) return;
    editarLista(s, (lista, i) => lista.filter((_, j) => j !== i));
    setSel(null);
  };

  // ── Agregar desde la paleta ─────────────────────────────────────────────────
  const agregar = (tipo: TipoCampo) => {
    const usadas = clavesUsadas(esquema);
    const nuevo = campoNuevo(tipo, usadas);
    // Dentro del grupo repetible seleccionado (o del grupo del subcampo seleccionado)
    const grupo = sel && tipo !== 'repetible'
      ? (sel.sub !== undefined ? sel : campoDe(sel)?.tipo === 'repetible' ? sel : null)
      : null;
    if (grupo) {
      const sec = secciones[grupo.sec];
      const destino = sec.campos[grupo.campo];
      const pos = (destino.campos ?? []).length;
      setSeccion(grupo.sec, {
        campos: sec.campos.map((c, j) => (j === grupo.campo ? { ...c, campos: [...(c.campos ?? []), nuevo] } : c)),
      });
      setSel({ sec: grupo.sec, campo: grupo.campo, sub: pos });
      return;
    }
    const s = sel?.sec ?? selSec ?? secciones.length - 1;
    if (s < 0) return;
    setSeccion(s, { campos: [...secciones[s].campos, nuevo] });
    setSel({ sec: s, campo: secciones[s].campos.length });
  };

  // ── Referencias para condiciones y fórmulas ─────────────────────────────────
  const referencias: CampoReferencia[] = [];
  for (const s of secciones) {
    for (const c of s.campos) {
      if (['separador', 'instruccion'].includes(c.tipo)) continue;
      if (c.tipo === 'repetible') {
        for (const h of c.campos ?? []) referencias.push({ key: `${c.key}.${h.key}`, etiqueta: `${c.etiqueta} › ${h.etiqueta} (columna)` });
        referencias.push({ key: c.key, etiqueta: `${c.etiqueta} (filas)` });
      } else if (seleccionado?.key !== c.key) {
        referencias.push({ key: c.key, etiqueta: c.etiqueta });
      }
    }
  }
  // Dentro de un grupo, también los campos de la misma fila
  if (grupoSeleccionado) {
    for (const h of grupoSeleccionado.campos ?? []) {
      if (h.key !== seleccionado?.key) referencias.unshift({ key: h.key, etiqueta: `${h.etiqueta} (misma fila)` });
    }
  }
  const camposRaiz = secciones.flatMap((s) => s.campos).filter((c) => !['separador', 'instruccion', 'repetible'].includes(c.tipo));

  // Claves usadas por OTROS campos (para avisar duplicados)
  const otrasClaves = (() => {
    const todas: string[] = [];
    const recorrer = (cs: Campo[]) => cs.forEach((c) => { if (c !== seleccionado) todas.push(c.key); recorrer(c.campos ?? []); });
    secciones.forEach((s) => recorrer(s.campos));
    return new Set(todas);
  })();

  // ── Guardar y publicar ──────────────────────────────────────────────────────
  const guardar = async (): Promise<boolean> => {
    setOcupado(true);
    setMensaje(null);
    const { error } = await supabase.from('formularios').update({
      nombre: datos.nombre, descripcion: datos.descripcion, icono: datos.icono, schema: datos.esquema,
      umbral_distancia_m: datos.umbral_distancia_m, duracion_minima_s: datos.duracion_minima_s,
    }).eq('id', id!);
    setOcupado(false);
    if (error) { setMensaje({ tipo: 'error', texto: mensajeError(error) }); return false; }
    setGuardado(JSON.stringify(datos));
    setMensaje({ tipo: 'ok', texto: 'Borrador guardado' });
    return true;
  };

  const publicar = async () => {
    const encontrados = revisarEsquema(esquema);
    setProblemas(encontrados);
    if (encontrados.some((p) => p.grave)) {
      setMensaje({ tipo: 'error', texto: 'Corrige los problemas marcados antes de publicar' });
      return;
    }
    if (!confirm(`¿Publicar como versión ${(versionActual ?? 0) + 1}? Los colaboradores la recibirán al sincronizar.`)) return;
    if (!(await guardar())) return;
    setOcupado(true);
    const { data, error } = await supabase.rpc('publicar_formulario', { p_formulario: id });
    setOcupado(false);
    if (error) return setMensaje({ tipo: 'error', texto: mensajeError(error) });
    setMensaje({ tipo: 'ok', texto: `Versión ${data} publicada` });
    setProblemas(null);
    cargar();
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── Encabezado ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-4 py-2.5">
        <button onClick={() => (!hayCambios || confirm('Hay cambios sin guardar. ¿Salir de todas formas?')) && navigate('/formularios')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-geo-text">
          <ArrowLeft className="h-4 w-4" /> Formularios
        </button>
        <input value={datos.icono} onChange={(e) => setDatos({ ...datos, icono: e.target.value })} disabled={soloLectura}
          className="w-10 bg-transparent text-center text-xl outline-none" aria-label="Ícono" />
        <input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} disabled={soloLectura}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" placeholder="Nombre del formulario" />
        <span className={`badge ${versionActual ? 'bg-primary-light text-primary' : 'bg-amber-50 text-amber-700'}`}>
          {versionActual ? `v${versionActual} publicada` : 'Sin publicar'}
        </span>
        {hayCambios && <span className="text-xs text-amber-700">Cambios sin guardar</span>}
        <button className="btn-secondary h-8 px-3" onClick={() => setPrevia((v) => !v)}>
          {previa ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {previa ? 'Editor' : 'Vista previa'}
        </button>
        {!soloLectura && (
          <>
            <button className="btn-secondary h-8 px-3" onClick={guardar} disabled={ocupado || !hayCambios}>
              <Save className="h-4 w-4" /> Guardar
            </button>
            <button className="btn-primary h-8 px-3" onClick={publicar} disabled={ocupado}>
              <Send className="h-4 w-4" /> Publicar
            </button>
          </>
        )}
      </div>

      {mensaje && (
        <div className={`flex items-center justify-between px-4 py-2 text-sm ${mensaje.tipo === 'ok' ? 'bg-primary-light text-primary' : 'bg-red-50 text-red-700'}`}>
          <span className="flex items-center gap-1.5">
            {mensaje.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {mensaje.texto}
          </span>
          <button onClick={() => setMensaje(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {problemas && problemas.length > 0 && (
        <div className="max-h-40 overflow-y-auto border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-amber-800">Revisión del formulario</p>
            <button onClick={() => setProblemas(null)}><X className="h-4 w-4 text-amber-700" /></button>
          </div>
          <ul className="mt-1 space-y-0.5">
            {problemas.map((p, i) => (
              <li key={i} className={p.grave ? 'text-red-700' : 'text-amber-800'}>{p.grave ? '✗' : '•'} {p.mensaje}</li>
            ))}
          </ul>
        </div>
      )}

      {previa ? (
        <div className="min-h-0 flex-1"><VistaPrevia esquema={esquema} nombre={datos.nombre} /></div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* ── Paleta ── */}
          {!soloLectura && (
            <div className="w-48 shrink-0 space-y-3 overflow-y-auto border-r border-gray-100 bg-geo-gray p-3">
              <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Agregar campo</p>
              <p className="text-xs text-gray-400">
                {grupoSeleccionado || seleccionado?.tipo === 'repetible'
                  ? `Se agrega dentro de "${(grupoSeleccionado ?? seleccionado)!.etiqueta}"`
                  : `Se agrega en "${secciones[sel?.sec ?? selSec ?? secciones.length - 1]?.titulo ?? '—'}"`}
              </p>
              {GRUPOS.map((g) => (
                <div key={g}>
                  <p className="mb-1 text-xs text-gray-400">{g}</p>
                  {TIPOS.filter((t) => t.grupo === g).map((t) => (
                    <button key={t.tipo} onClick={() => agregar(t.tipo)} disabled={secciones.length === 0}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white hover:shadow-sm disabled:opacity-30">
                      <span className="w-6 text-center font-mono text-gray-500">{t.icono}</span> {t.etiqueta}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ── Lienzo ── */}
          <div className="min-w-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="card space-y-3">
              <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Configuración</p>
              <div>
                <label className="label">Descripción</label>
                <input className="input" value={datos.descripcion} disabled={soloLectura} placeholder="Para qué sirve este formulario"
                  onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="label">Título de cada registro</label>
                  <select className="input" value={esquema.claveNombre} disabled={soloLectura}
                    onChange={(e) => setEsquema((x) => ({ ...x, claveNombre: e.target.value }))}>
                    <option value="">— Elegir —</option>
                    {camposRaiz.map((c) => <option key={c.key} value={c.key}>{c.etiqueta}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Subtítulo</label>
                  <select className="input" value={esquema.claveSubtitulo ?? ''} disabled={soloLectura}
                    onChange={(e) => setEsquema((x) => ({ ...x, claveSubtitulo: e.target.value }))}>
                    <option value="">— Ninguno —</option>
                    {camposRaiz.map((c) => <option key={c.key} value={c.key}>{c.etiqueta}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Ubicación de la finca</label>
                  <select className="input" value={esquema.claveUbicacion ?? ''} disabled={soloLectura}
                    onChange={(e) => setEsquema((x) => ({ ...x, claveUbicacion: e.target.value || undefined }))}>
                    <option value="">— Ninguna —</option>
                    {camposRaiz.filter((c) => c.tipo === 'gps').map((c) => <option key={c.key} value={c.key}>{c.etiqueta}</option>)}
                  </select>
                </div>
              </div>
              <details className="rounded-lg bg-geo-gray px-3 py-2 text-sm">
                <summary className="cursor-pointer text-gray-600">Control de veracidad (solo lo ve el equipo que revisa)</summary>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="label">Marcar si está a más de (metros)</label>
                    <input type="number" min={0} className="input" value={datos.umbral_distancia_m} disabled={soloLectura}
                      onChange={(e) => setDatos({ ...datos, umbral_distancia_m: Math.max(0, Number(e.target.value) || 0) })} />
                  </div>
                  <div>
                    <label className="label">Marcar si se llenó en menos de (minutos)</label>
                    <input type="number" min={0} className="input" value={Math.round(datos.duracion_minima_s / 60)} disabled={soloLectura}
                      onChange={(e) => setDatos({ ...datos, duracion_minima_s: Math.max(0, Number(e.target.value) || 0) * 60 })} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Nunca bloquea al técnico ni se le muestra: solo marca el registro para revisión. 0 = no marcar.
                </p>
              </details>
            </div>

            {secciones.map((sec, si) => (
              <div key={sec.id} className={`card overflow-hidden border-2 p-0 ${selSec === si && !sel ? 'border-primary' : 'border-transparent'}`}>
                <div className="flex cursor-pointer items-center gap-2 bg-geo-gray px-3 py-2"
                  onClick={() => { setSelSec(si); setSel(null); }}>
                  <span className="text-xs font-semibold text-gray-400">{si + 1}</span>
                  <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" value={sec.titulo}
                    disabled={soloLectura} onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setSeccion(si, { titulo: e.target.value })} placeholder="Título de la sección" />
                  {sec.condicion && <span className="badge bg-primary-light text-primary">condicional</span>}
                  {!soloLectura && (
                    <div className="flex" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-icon" disabled={si === 0}
                        onClick={() => setSecciones((ss) => { const c = [...ss]; [c[si - 1], c[si]] = [c[si], c[si - 1]]; return c; })}>
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button className="btn-icon" disabled={si === secciones.length - 1}
                        onClick={() => setSecciones((ss) => { const c = [...ss]; [c[si + 1], c[si]] = [c[si], c[si + 1]]; return c; })}>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button className="btn-icon hover:text-red-600" title="Borrar sección"
                        onClick={() => {
                          if (sec.campos.length && !confirm(`¿Borrar "${sec.titulo}" y sus ${sec.campos.length} campos?`)) return;
                          setSecciones((ss) => ss.filter((_, j) => j !== si));
                          setSel(null); setSelSec(null);
                        }}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {selSec === si && !sel && !soloLectura && (
                  <div className="space-y-2 border-b border-gray-100 bg-primary-light/30 px-3 py-2">
                    <input className="input h-8 py-1 text-xs" value={sec.descripcion ?? ''} placeholder="Descripción de la sección (opcional)"
                      onChange={(e) => setSeccion(si, { descripcion: e.target.value })} />
                    {sec.condicion ? (
                      <EditorCondicion condicion={sec.condicion} onChange={(condicion) => setSeccion(si, { condicion })}
                        campos={referencias.filter((r) => !r.key.includes('.'))} />
                    ) : (
                      <button className="text-xs text-primary hover:underline"
                        onClick={() => setSeccion(si, { condicion: { logica: 'y', reglas: [{ campo: '', operador: 'igual', valor: '' }] } })}>
                        + Mostrar esta sección solo si…
                      </button>
                    )}
                  </div>
                )}

                <div className="divide-y divide-gray-50">
                  {sec.campos.length === 0 && (
                    <p className="px-3 py-4 text-center text-xs text-gray-400">Sin campos. Elige un tipo en la paleta de la izquierda.</p>
                  )}
                  {sec.campos.map((c, ci) => (
                    <div key={`${c.key}-${ci}`}>
                      <FilaCampo campo={c} activo={sel?.sec === si && sel.campo === ci && sel.sub === undefined}
                        soloLectura={soloLectura} primero={ci === 0} ultimo={ci === sec.campos.length - 1}
                        onElegir={() => { setSel({ sec: si, campo: ci }); setSelSec(si); }}
                        onMover={(d) => mover({ sec: si, campo: ci }, d)} onQuitar={() => quitar({ sec: si, campo: ci })} />
                      {c.tipo === 'repetible' && (
                        <div className="ml-8 border-l-2 border-primary-light">
                          {(c.campos ?? []).length === 0 && (
                            <p className="px-3 py-2 text-xs text-gray-400">Selecciona el grupo y agrega sus campos desde la paleta.</p>
                          )}
                          {(c.campos ?? []).map((h, hi) => (
                            <FilaCampo key={`${h.key}-${hi}`} campo={h} activo={sel?.sec === si && sel.campo === ci && sel.sub === hi}
                              soloLectura={soloLectura} primero={hi === 0} ultimo={hi === (c.campos ?? []).length - 1}
                              onElegir={() => { setSel({ sec: si, campo: ci, sub: hi }); setSelSec(si); }}
                              onMover={(d) => mover({ sec: si, campo: ci, sub: hi }, d)}
                              onQuitar={() => quitar({ sec: si, campo: ci, sub: hi })} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {!soloLectura && (
              <button onClick={() => { setSecciones((ss) => [...ss, seccionNueva(ss.length + 1)]); setSelSec(secciones.length); setSel(null); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm text-gray-400 hover:border-primary hover:text-primary">
                <Plus className="h-4 w-4" /> Nueva sección
              </button>
            )}
          </div>

          {/* ── Propiedades ── */}
          <div className="w-80 shrink-0 overflow-hidden border-l border-gray-100 bg-white">
            {seleccionado && sel && !soloLectura ? (
              <Propiedades
                key={`${sel.sec}-${sel.campo}-${sel.sub ?? ''}`}
                campo={seleccionado}
                onChange={(c) => reemplazarCampo(sel, c)}
                onCerrar={() => setSel(null)}
                referencias={referencias}
                clavePublicada={publicadas.claves.has((grupoSeleccionado ? `${grupoSeleccionado.key}.` : '') + seleccionado.key)}
                opcionesPublicadas={publicadas.opciones.get((grupoSeleccionado ? `${grupoSeleccionado.key}.` : '') + seleccionado.key) ?? new Set()}
                clavesUsadas={otrasClaves}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-gray-400">
                <Settings className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">{soloLectura ? 'Solo lectura: tu rol no permite editar formularios.' : 'Selecciona un campo para editar sus propiedades'}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilaCampo({ campo, activo, soloLectura, primero, ultimo, onElegir, onMover, onQuitar }: {
  campo: Campo; activo: boolean; soloLectura: boolean; primero: boolean; ultimo: boolean;
  onElegir: () => void; onMover: (d: -1 | 1) => void; onQuitar: () => void;
}) {
  const meta = metaTipo(campo.tipo);
  const detalles = [
    meta?.etiqueta,
    campo.condicion && 'con condición',
    campo.tipo === 'calculado' && campo.formula && 'calculado',
    campo.tipo === 'repetible' && `${(campo.campos ?? []).length} campos por fila`,
  ].filter(Boolean).join(' · ');
  return (
    <div onClick={onElegir}
      className={`flex cursor-pointer items-center gap-2 px-3 py-2 ${activo ? 'bg-primary-light' : 'hover:bg-geo-gray'}`}>
      <span className="w-6 text-center font-mono text-xs text-gray-400">{meta?.icono}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {campo.etiqueta}{campo.obligatorio && <span className="ml-1 text-red-400">*</span>}
        </p>
        <p className="truncate text-xs text-gray-400">{detalles} · <span className="font-mono">{campo.key}</span></p>
      </div>
      {!soloLectura && (
        <div className="flex shrink-0" onClick={(e) => e.stopPropagation()}>
          <button className="btn-icon" disabled={primero} onClick={() => onMover(-1)}><ChevronUp className="h-3.5 w-3.5" /></button>
          <button className="btn-icon" disabled={ultimo} onClick={() => onMover(1)}><ChevronDown className="h-3.5 w-3.5" /></button>
          <button className="btn-icon hover:text-red-600" onClick={onQuitar}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  );
}
