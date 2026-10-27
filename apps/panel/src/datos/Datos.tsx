// Pantalla Datos: tabla + mapa sincronizados, filtros estilo Fulcrum y exportación.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Download, Map as MapIcon, Table2, Columns2, Plus, X, AlertTriangle, SlidersHorizontal, RefreshCw } from 'lucide-react';
import type { Esquema, Operador } from '@geoorigen/motor';
import { supabase, mensajeError } from '../lib/supabase.ts';
import { useSesion } from '../lib/sesion.tsx';
import { OPERADORES } from '../editor/catalogo.ts';
import {
  ALERTAS, FILTROS_VACIOS, LIMITE, camposConValor, consultarRegistros, tituloRegistro, valorComoTexto,
  type Filtros, type RegistroPanel,
} from './registros.ts';
import { Mapa, COLOR_ESTADO } from './Mapa.tsx';
import { Detalle } from './Detalle.tsx';
import { exportarCSV, exportarExcel, exportarGeoJSON, exportarKML } from './exportar.ts';

interface FormularioPublicado {
  id: string; nombre: string; icono: string; version_actual: number;
  estados: { valor: string; etiqueta: string; color: string }[];
}

const POR_PAGINA = 50;
const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const fechaCorta = (t: string) => new Date(t).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export function Datos() {
  const { org } = useSesion();
  const conControl = org?.rol === 'admin' || org?.rol === 'editor' || org?.rol === 'lector';
  const puedeCambiarEstado = (org?.rol === 'admin' || org?.rol === 'editor') && !org?.expira_en;

  const [formularios, setFormularios] = useState<FormularioPublicado[]>([]);
  const [cargandoForms, setCargandoForms] = useState(true);
  const [formId, setFormId] = useState<string>('');
  const [esquemas, setEsquemas] = useState<Map<string, Esquema>>(new Map());  // clave: id@version
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string }[]>([]);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [buscarTexto, setBuscarTexto] = useState('');
  const [filas, setFilas] = useState<RegistroPanel[]>([]);
  const [recortado, setRecortado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<'tabla' | 'mapa' | 'ambos'>(() => (leer('geoorigen.datos.vista') as 'tabla') || 'ambos');
  const [pagina, setPagina] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [columnas, setColumnas] = useState<string[]>([]);
  const [verColumnas, setVerColumnas] = useState(false);
  const [verReglas, setVerReglas] = useState(false);
  const [verExportar, setVerExportar] = useState(false);

  const form = formularios.find((f) => f.id === formId);
  const esquema = form ? esquemas.get(`${form.id}@${form.version_actual}`) ?? null : null;
  const campos = useMemo(() => (esquema ? camposConValor(esquema) : []), [esquema]);

  // Formularios publicados y técnicos de la organización
  useEffect(() => {
    if (!org) return;
    (async () => {
      const { data } = await supabase.from('formularios').select('id, nombre, icono, version_actual, estados')
        .eq('org_id', org.org_id).not('version_actual', 'is', null).order('nombre');
      const lista = (data ?? []) as FormularioPublicado[];
      setFormularios(lista);
      setCargandoForms(false);
      const recordado = leer(`geoorigen.datos.form.${org.org_id}`);
      setFormId(lista.find((f) => f.id === recordado)?.id ?? lista[0]?.id ?? '');

      const { data: ms } = await supabase.from('miembros').select('user_id').eq('org_id', org.org_id);
      const ids = (ms ?? []).map((m) => m.user_id);
      const { data: ps } = ids.length ? await supabase.from('perfiles').select('user_id, nombre, email').in('user_id', ids) : { data: [] };
      setTecnicos((ps ?? []).map((p) => ({ id: p.user_id, nombre: p.nombre || p.email })).sort((a, b) => a.nombre.localeCompare(b.nombre)));
    })();
  }, [org]);

  /** Trae (una sola vez) el esquema de una versión publicada */
  const asegurarEsquema = useCallback(async (formularioId: string, version: number) => {
    const clave = `${formularioId}@${version}`;
    if (esquemas.has(clave)) return;
    const { data } = await supabase.from('formulario_versiones').select('schema')
      .eq('formulario_id', formularioId).eq('version', version).single();
    if (data) setEsquemas((m) => new Map(m).set(clave, data.schema as Esquema));
  }, [esquemas]);

  useEffect(() => {
    if (!form || !org) return;
    guardar(`geoorigen.datos.form.${org.org_id}`, form.id);
    asegurarEsquema(form.id, form.version_actual);
  }, [form, org, asegurarEsquema]);

  // Columnas visibles: las recordadas o las primeras 4 preguntas
  useEffect(() => {
    if (!form || campos.length === 0) return;
    const recordadas = leer(`geoorigen.datos.cols.${form.id}`);
    setColumnas(recordadas ? JSON.parse(recordadas) : campos.filter((c) => c.tipo !== 'repetible').slice(0, 4).map((c) => c.key));
  }, [form, campos]);

  const consultar = useCallback(async () => {
    if (!org || !formId) return;
    setCargando(true);
    setError('');
    try {
      const r = await consultarRegistros(org.org_id, formId, filtros);
      setFilas(r.filas);
      setRecortado(r.recortado);
      setPagina(0);
    } catch (e) {
      setError(mensajeError(e as Error));
    }
    setCargando(false);
  }, [org, formId, filtros]);

  useEffect(() => { consultar(); }, [consultar]);

  // La búsqueda se aplica al dejar de escribir
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.buscar === buscarTexto ? f : { ...f, buscar: buscarTexto })), 400);
    return () => clearTimeout(t);
  }, [buscarTexto]);

  const registroSel = filas.find((r) => r.id === sel) ?? null;
  useEffect(() => {
    if (registroSel) asegurarEsquema(registroSel.formulario_id, registroSel.formulario_version);
  }, [registroSel, asegurarEsquema]);

  const setFiltro = (cambio: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...cambio }));
  const filtrosActivos = [filtros.tecnico, filtros.estado, filtros.desde, filtros.hasta, filtros.buscar, filtros.alerta]
    .filter(Boolean).length + filtros.reglas.filter((r) => r.campo).length;

  const visibles = filas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const paginas = Math.ceil(filas.length / POR_PAGINA);
  const conAlertas = filas.filter((r) => r.alertas.length).length;

  const alternarColumna = (k: string) => {
    const nuevas = columnas.includes(k) ? columnas.filter((c) => c !== k) : [...columnas, k];
    setColumnas(nuevas);
    if (form) guardar(`geoorigen.datos.cols.${form.id}`, JSON.stringify(nuevas));
  };

  const exportar = async (tipo: 'xlsx' | 'csv' | 'kml' | 'geojson') => {
    setVerExportar(false);
    if (!esquema || !form) return;
    if (tipo === 'xlsx') await exportarExcel(filas, esquema, form.nombre, conControl);
    if (tipo === 'csv') exportarCSV(filas, esquema, form.nombre, conControl);
    if (tipo === 'kml') exportarKML(filas, esquema, form.nombre);
    if (tipo === 'geojson') exportarGeoJSON(filas, esquema, form.nombre);
  };

  if (cargandoForms) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary-light border-t-primary" />
      </div>
    );
  }

  if (formularios.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-gray-400">
        <div><p className="text-3xl">📭</p><p className="mt-2 text-sm">Todavía no hay formularios publicados en esta organización.</p></div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Barra superior ── */}
        <div className="space-y-2 border-b border-gray-100 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-auto py-1.5 font-semibold" value={formId} onChange={(e) => { setFormId(e.target.value); setSel(null); setFiltros(FILTROS_VACIOS); setBuscarTexto(''); }}>
              {formularios.map((f) => <option key={f.id} value={f.id}>{f.icono} {f.nombre}</option>)}
            </select>
            <div className="relative min-w-48 flex-1">
              <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-gray-400" />
              <input className="input pl-8" placeholder="Buscar cédula, nombre, finca, vereda…" value={buscarTexto}
                onChange={(e) => setBuscarTexto(e.target.value)} />
            </div>
            <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
              {([['tabla', Table2, 'Tabla'], ['ambos', Columns2, 'Ambos'], ['mapa', MapIcon, 'Mapa']] as const).map(([v, Icono, t]) => (
                <button key={v} title={t} onClick={() => { setVista(v); guardar('geoorigen.datos.vista', v); }}
                  className={`rounded-md px-2 py-1 ${vista === v ? 'bg-primary-light text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
                  <Icono className="h-4 w-4" />
                </button>
              ))}
            </div>
            <button className="btn-icon" title="Actualizar" onClick={consultar}><RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} /></button>
            <div className="relative">
              <button className="btn-primary h-9 px-3" onClick={() => setVerExportar((v) => !v)} disabled={!filas.length}>
                <Download className="h-4 w-4" /> Exportar
              </button>
              {verExportar && (
                <div className="absolute right-0 z-[500] mt-1 w-56 rounded-lg border border-gray-100 bg-white py-1 text-sm shadow-lg">
                  <p className="px-3 py-1 text-xs text-gray-400">{filas.length} registro(s) filtrado(s)</p>
                  <button className="block w-full px-3 py-1.5 text-left hover:bg-geo-gray" onClick={() => exportar('xlsx')}>Excel (.xlsx)</button>
                  <button className="block w-full px-3 py-1.5 text-left hover:bg-geo-gray" onClick={() => exportar('csv')}>CSV para Excel</button>
                  <button className="block w-full px-3 py-1.5 text-left hover:bg-geo-gray" onClick={() => exportar('kml')}>KML (Google Earth)</button>
                  <button className="block w-full px-3 py-1.5 text-left hover:bg-geo-gray" onClick={() => exportar('geojson')}>GeoJSON (SIG)</button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select className="input w-auto py-1" value={filtros.tecnico} onChange={(e) => setFiltro({ tecnico: e.target.value })}>
              <option value="">Todos los técnicos</option>
              {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <select className="input w-auto py-1" value={filtros.estado} onChange={(e) => setFiltro({ estado: e.target.value })}>
              <option value="">Todos los estados</option>
              {(form?.estados ?? []).map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
            </select>
            <label className="flex items-center gap-1 text-gray-500">Desde
              <input type="date" className="input w-auto py-1" value={filtros.desde} onChange={(e) => setFiltro({ desde: e.target.value })} />
            </label>
            <label className="flex items-center gap-1 text-gray-500">Hasta
              <input type="date" className="input w-auto py-1" value={filtros.hasta} onChange={(e) => setFiltro({ hasta: e.target.value })} />
            </label>
            {conControl && (
              <select className={`input w-auto py-1 ${filtros.alerta ? 'border-red-300 text-red-700' : ''}`} value={filtros.alerta}
                onChange={(e) => setFiltro({ alerta: e.target.value })}>
                <option value="">Con y sin alertas</option>
                <option value="cualquiera">⚠ Solo con alertas</option>
                {Object.entries(ALERTAS).map(([k, a]) => <option key={k} value={k}>⚠ {a.texto}</option>)}
              </select>
            )}
            <button className={`btn-secondary h-8 px-2 ${filtros.reglas.length ? 'border-primary text-primary' : ''}`} onClick={() => setVerReglas((v) => !v)}>
              <SlidersHorizontal className="h-4 w-4" /> Por pregunta{filtros.reglas.length ? ` (${filtros.reglas.length})` : ''}
            </button>
            {filtrosActivos > 0 && (
              <button className="text-xs text-gray-500 hover:underline" onClick={() => { setFiltros(FILTROS_VACIOS); setBuscarTexto(''); }}>
                Quitar filtros
              </button>
            )}
          </div>

          {verReglas && (
            <div className="space-y-1.5 rounded-lg bg-geo-gray p-2">
              {filtros.reglas.map((r, i) => {
                const sinValor = OPERADORES.find((o) => o.op === r.operador)?.sinValor;
                const campo = campos.find((c) => c.key === r.campo);
                const upd = (cambio: Partial<typeof r>) => setFiltro({ reglas: filtros.reglas.map((x, j) => (j === i ? { ...x, ...cambio } : x)) });
                return (
                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                    <select className="input w-auto py-1 text-xs" value={r.campo} onChange={(e) => upd({ campo: e.target.value, valor: '' })}>
                      <option value="">— Pregunta —</option>
                      {campos.filter((c) => !['repetible', 'foto', 'firma', 'gps'].includes(c.tipo)).map((c) => <option key={c.key} value={c.key}>{c.etiqueta}</option>)}
                    </select>
                    <select className="input w-auto py-1 text-xs" value={r.operador} onChange={(e) => upd({ operador: e.target.value as Operador })}>
                      {OPERADORES.map((o) => <option key={o.op} value={o.op}>{o.etiqueta}</option>)}
                    </select>
                    {!sinValor && (campo?.opciones?.length || campo?.tipo === 'sino' ? (
                      <select className="input w-auto py-1 text-xs" value={r.valor ?? ''} onChange={(e) => upd({ valor: e.target.value })}>
                        <option value="">—</option>
                        {(campo.tipo === 'sino' ? [{ valor: 'Si', etiqueta: 'Sí' }, { valor: 'No', etiqueta: 'No' }] : campo.opciones ?? [])
                          .map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                      </select>
                    ) : (
                      <input className="input w-40 py-1 text-xs" value={r.valor ?? ''} placeholder="Valor" onChange={(e) => upd({ valor: e.target.value })} />
                    ))}
                    <button className="btn-icon" onClick={() => setFiltro({ reglas: filtros.reglas.filter((_, j) => j !== i) })}><X className="h-3.5 w-3.5" /></button>
                  </div>
                );
              })}
              <button className="flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={() => setFiltro({ reglas: [...filtros.reglas, { campo: '', operador: 'igual', valor: '' }] })}>
                <Plus className="h-3 w-3" /> Agregar filtro por pregunta
              </button>
            </div>
          )}

          <p className="text-xs text-gray-500">
            {cargando ? 'Cargando…' : `${filas.length} registro(s)`}
            {conControl && conAlertas > 0 && <span className="ml-2 text-red-600">· {conAlertas} con alertas</span>}
            {recortado && <span className="ml-2 text-amber-700">· se muestran los {LIMITE} más recientes; afina los filtros</span>}
          </p>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        {/* ── Contenido ── */}
        <div className={`flex min-h-0 flex-1 ${vista === 'ambos' ? 'flex-col xl:flex-row' : ''}`}>
          {vista !== 'mapa' && (
            <div className={`flex min-h-0 min-w-0 flex-col ${vista === 'ambos' ? 'h-1/2 xl:h-auto xl:w-3/5' : 'flex-1'}`}>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white text-left text-xs text-gray-400 shadow-sm">
                    <tr>
                      <th className="px-3 py-2 font-medium">Registro</th>
                      <th className="px-3 py-2 font-medium">Técnico</th>
                      <th className="px-3 py-2 font-medium">Fecha</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      {conControl && <th className="px-3 py-2 font-medium" title="Alertas de control">⚠</th>}
                      {columnas.map((k) => <th key={k} className="px-3 py-2 font-medium whitespace-nowrap">{campos.find((c) => c.key === k)?.etiqueta ?? k}</th>)}
                      <th className="relative px-2 py-2">
                        <button className="btn-icon" title="Elegir columnas" onClick={() => setVerColumnas((v) => !v)}><Columns2 className="h-4 w-4" /></button>
                        {verColumnas && (
                          <div className="absolute right-0 z-20 mt-1 max-h-80 w-64 overflow-y-auto rounded-lg border border-gray-100 bg-white p-2 text-left text-sm font-normal text-geo-text shadow-lg">
                            <p className="mb-1 text-xs text-gray-400">Columnas visibles</p>
                            {campos.filter((c) => c.tipo !== 'repetible').map((c) => (
                              <label key={c.key} className="flex items-center gap-2 py-0.5">
                                <input type="checkbox" className="accent-primary" checked={columnas.includes(c.key)} onChange={() => alternarColumna(c.key)} />
                                <span className="truncate">{c.etiqueta}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {visibles.map((r) => {
                      const { titulo, subtitulo } = tituloRegistro(r, esquema);
                      return (
                        <tr key={r.id} onClick={() => setSel(r.id)}
                          className={`cursor-pointer ${sel === r.id ? 'bg-primary-light' : 'hover:bg-geo-gray'}`}>
                          <td className="min-w-56 px-3 py-2"><p className="font-medium">{titulo}</p>{subtitulo && <p className="text-xs text-gray-400">{subtitulo}</p>}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{r.tecnico_nombre || r.tecnico_email}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-500">{fechaCorta(r.captura_inicio_en ?? r.creado_en)}</td>
                          <td className="px-3 py-2"><span className="badge text-white" style={{ background: COLOR_ESTADO[r.estado] ?? '#6b7280' }}>{r.estado}</span></td>
                          {conControl && (
                            <td className="px-3 py-2">
                              {r.alertas.length > 0 && (
                                <span className="flex items-center gap-0.5 text-red-600" title={r.alertas.map((a) => ALERTAS[a]?.texto ?? a).join(', ')}>
                                  <AlertTriangle className="h-3.5 w-3.5" /> {r.alertas.length}
                                </span>
                              )}
                            </td>
                          )}
                          {columnas.map((k) => {
                            const c = campos.find((x) => x.key === k);
                            return <td key={k} className="max-w-56 truncate px-3 py-2">{c ? valorComoTexto(c, r.datos[k]) : ''}</td>;
                          })}
                          <td />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!cargando && filas.length === 0 && <p className="py-12 text-center text-sm text-gray-400">No hay registros con estos filtros.</p>}
              </div>
              {paginas > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 bg-white px-3 py-2 text-xs text-gray-500">
                  <span>Página {pagina + 1} de {paginas}</span>
                  <div className="flex gap-1">
                    <button className="btn-secondary h-7 px-2" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
                    <button className="btn-secondary h-7 px-2" disabled={pagina >= paginas - 1} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {vista !== 'tabla' && (
            <div className={`min-h-0 min-w-0 ${vista === 'ambos' ? 'h-1/2 border-t border-gray-100 xl:h-auto xl:flex-1 xl:border-t-0 xl:border-l' : 'flex-1'}`}>
              <Mapa filas={filas} esquema={esquema} seleccionado={sel} onElegir={setSel} />
            </div>
          )}
        </div>
      </div>

      {registroSel && (
        <div className="fixed inset-0 z-[600] md:static md:z-auto">
          <Detalle
            registro={registroSel}
            esquemaVersion={esquemas.get(`${registroSel.formulario_id}@${registroSel.formulario_version}`) ?? null}
            estados={form?.estados ?? []}
            puedeCambiarEstado={puedeCambiarEstado}
            onCerrar={() => setSel(null)}
            onCambio={consultar}
          />
        </div>
      )}
    </div>
  );
}
