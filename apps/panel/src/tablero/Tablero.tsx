// Tablero de la organización (estilo Power BI): indicadores, encuestas por día,
// por técnico, por estado y por alerta, y gráficos por pregunta del formulario.
// Todo responde a los mismos filtros de arriba.

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, X, RefreshCw } from 'lucide-react';
import type { Campo, Esquema } from '@geoorigen/motor';
import { supabase, mensajeError } from '../lib/supabase.ts';
import { useSesion } from '../lib/sesion.tsx';
import { ALERTAS, camposConValor, valorComoTexto } from '../datos/registros.ts';

// Un solo tono para todas las marcas (verde de la marca, validado contra el fondo)
const TONO = '#1d9e75';
const LIMITE = 5000;
const DIA = 86400000;

interface Fila {
  id: string; formulario_id: string; estado: string; creado_por: string; creado_en: string;
  alertas: string[]; tecnico_nombre: string | null; tecnico_email: string | null;
  datos?: Record<string, unknown>;
}
interface Form { id: string; nombre: string; version_actual: number; estados: { valor: string; etiqueta: string }[] }
interface Dato { etiqueta: string; valor: number; detalle?: string }

const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const compacto = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(Math.round(n * 10) / 10));
const diaLocal = (t: string | Date) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const PERIODOS = [
  { id: '7', texto: 'Últimos 7 días', dias: 7 },
  { id: '30', texto: 'Últimos 30 días', dias: 30 },
  { id: '90', texto: 'Últimos 90 días', dias: 90 },
  { id: 'anio', texto: 'Este año', dias: 0 },
  { id: 'todo', texto: 'Todo', dias: -1 },
] as const;

function desdePeriodo(id: string): Date | null {
  const p = PERIODOS.find((x) => x.id === id);
  if (!p || p.dias < 0) return null;
  if (p.dias === 0) return new Date(new Date().getFullYear(), 0, 1);
  const d = new Date(Date.now() - (p.dias - 1) * DIA);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Piezas ────────────────────────────────────────────────────────────────────

function Indicador({ titulo, valor, nota, alerta }: { titulo: string; valor: string; nota?: string; alerta?: boolean }) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1 text-xs text-gray-500">{alerta && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}{titulo}</p>
      <p className="mt-1 text-2xl font-semibold">{valor}</p>
      {nota && <p className="text-xs text-gray-400">{nota}</p>}
    </div>
  );
}

function Panel({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="card flex flex-col p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {accion}
      </div>
      {children}
    </div>
  );
}

/** Barras horizontales: una por categoría, valor en la punta, tooltip al pasar el mouse */
function Barras({ datos, total, vacio = 'Sin datos con estos filtros' }: { datos: Dato[]; total?: number; vacio?: string }) {
  const [sobre, setSobre] = useState<number | null>(null);
  if (!datos.length) return <p className="py-6 text-center text-sm text-gray-400">{vacio}</p>;
  const max = Math.max(...datos.map((d) => d.valor), 1);
  return (
    <div className="space-y-1.5">
      {datos.map((d, i) => {
        const pct = total ? ` · ${Math.round((d.valor / total) * 100)} %` : '';
        return (
          <div key={d.etiqueta + i} className="relative grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-2 text-sm"
            onMouseEnter={() => setSobre(i)} onMouseLeave={() => setSobre(null)}>
            <span className="truncate text-gray-600" title={d.etiqueta}>{d.etiqueta}</span>
            <div className="flex items-center gap-2 py-0.5">
              <div className="h-4 rounded-r-[4px] transition-opacity"
                style={{ width: `${Math.max(2, (d.valor / max) * 85)}%`, background: TONO, opacity: sobre === null || sobre === i ? 1 : 0.45 }} />
              <span className="shrink-0 text-xs text-gray-600 tabular-nums">{compacto(d.valor)}</span>
            </div>
            {sobre === i && (
              <div className="pointer-events-none absolute right-0 bottom-full z-10 mb-1 rounded-md bg-geo-text px-2 py-1 text-xs whitespace-nowrap text-white shadow">
                {d.etiqueta}: <strong>{d.valor.toLocaleString('es-CO')}</strong>{pct}{d.detalle ? ` · ${d.detalle}` : ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Encuestas por día (o por semana si el periodo es largo): columnas con línea guía al pasar el mouse */
function PorTiempo({ filas, desde }: { filas: Fila[]; desde: Date | null }) {
  const [sobre, setSobre] = useState<number | null>(null);
  const serie = useMemo(() => {
    if (!filas.length) return [];
    const inicio = desde ?? new Date(Math.min(...filas.map((f) => new Date(f.creado_en).getTime())));
    inicio.setHours(0, 0, 0, 0);
    const dias = Math.max(1, Math.ceil((Date.now() - inicio.getTime()) / DIA));
    const semanal = dias > 92;
    const paso = semanal ? 7 : 1;
    const cubetas: { clave: string; etiqueta: string; valor: number }[] = [];
    const indice = new Map<string, number>();
    for (let t = inicio.getTime(); t <= Date.now(); t += paso * DIA) {
      const d = new Date(t);
      indice.set(diaLocal(d), cubetas.length);
      cubetas.push({
        clave: diaLocal(d),
        etiqueta: (semanal ? 'Semana del ' : '') + d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', ...(semanal ? { year: '2-digit' } : {}) }),
        valor: 0,
      });
    }
    for (const f of filas) {
      const t = new Date(f.creado_en).getTime();
      const n = Math.floor((t - inicio.getTime()) / (paso * DIA));
      if (n >= 0 && n < cubetas.length) cubetas[n].valor++;
    }
    return cubetas;
  }, [filas, desde]);

  if (!serie.length) return <p className="py-10 text-center text-sm text-gray-400">Sin encuestas en este periodo</p>;
  const max = Math.max(...serie.map((s) => s.valor), 1);
  // Marcas del eje: 0, la mitad y el máximo, redondeados
  const tope = max <= 5 ? max : Math.ceil(max / 5) * 5;
  const ancho = 100 / serie.length;
  return (
    <div className="relative">
      <div className="flex h-44 gap-2">
        <div className="flex flex-col justify-between text-right text-[10px] text-gray-400 tabular-nums">
          <span>{compacto(tope)}</span><span>{compacto(tope / 2)}</span><span>0</span>
        </div>
        <div className="relative flex-1 border-b border-l border-gray-200" onMouseLeave={() => setSobre(null)}>
          <div className="absolute inset-x-0 top-1/2 border-t border-gray-100" />
          <div className="absolute inset-0 flex items-end">
            {serie.map((s, i) => (
              <div key={s.clave} className="relative flex h-full items-end justify-center" style={{ width: `${ancho}%` }}
                onMouseEnter={() => setSobre(i)}>
                {sobre === i && <div className="absolute inset-y-0 left-1/2 border-l border-gray-300" />}
                <div className="relative rounded-t-[4px]"
                  style={{ height: `${(s.valor / tope) * 100}%`, width: 'min(24px, calc(100% - 2px))', background: TONO, opacity: sobre === null || sobre === i ? 1 : 0.55 }} />
              </div>
            ))}
          </div>
          {sobre !== null && (
            <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md bg-geo-text px-2 py-1 text-xs whitespace-nowrap text-white shadow"
              style={{ left: `${(sobre + 0.5) * ancho}%` }}>
              {serie[sobre].etiqueta}: <strong>{serie[sobre].valor}</strong> encuesta(s)
            </div>
          )}
        </div>
      </div>
      <div className="mt-1 flex justify-between pl-8 text-[10px] text-gray-400">
        <span>{serie[0].etiqueta}</span><span>{serie[serie.length - 1].etiqueta}</span>
      </div>
    </div>
  );
}

/** Gráfico de una pregunta: reparto de respuestas o resumen numérico */
function GraficoPregunta({ campo, filas }: { campo: Campo; filas: Fila[] }) {
  const valores = filas.map((f) => f.datos?.[campo.key]).filter((v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length));
  const numerico = ['numero', 'decimal', 'calificacion', 'calculado'].includes(campo.tipo);
  const nums = numerico ? valores.map((v) => Number(v)).filter((n) => Number.isFinite(n)) : [];

  if (numerico && nums.length) {
    const suma = nums.reduce((a, b) => a + b, 0);
    const min = Math.min(...nums), max = Math.max(...nums);
    // Reparto en 5 rangos iguales
    const rangos = 5, paso = (max - min) / rangos || 1;
    const cubetas: Dato[] = Array.from({ length: max === min ? 1 : rangos }, (_, i) => ({
      etiqueta: max === min ? String(min) : `${compacto(min + i * paso)} – ${compacto(min + (i + 1) * paso)}`, valor: 0,
    }));
    nums.forEach((n) => { cubetas[max === min ? 0 : Math.min(rangos - 1, Math.floor((n - min) / paso))].valor++; });
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          {[['Promedio', suma / nums.length], ['Mínimo', min], ['Máximo', max], ['Suma', suma]].map(([t, v]) => (
            <div key={t as string} className="rounded-lg bg-geo-gray px-2 py-1.5">
              <p className="text-[10px] text-gray-500">{t}</p>
              <p className="font-semibold tabular-nums">{compacto(v as number)}</p>
            </div>
          ))}
        </div>
        <Barras datos={cubetas} total={nums.length} />
        <p className="text-xs text-gray-400">{nums.length} respuesta(s)</p>
      </div>
    );
  }

  // Opciones, sí/no, casillas y textos: cuántas veces aparece cada respuesta
  const cuenta = new Map<string, number>();
  for (const v of valores) {
    const lista = Array.isArray(v) && campo.tipo === 'checkbox' ? (v as string[]) : [v];
    for (const x of lista) {
      const t = valorComoTexto({ ...campo, tipo: campo.tipo === 'checkbox' ? 'select' : campo.tipo }, x as string) || String(x);
      cuenta.set(t, (cuenta.get(t) ?? 0) + 1);
    }
  }
  const orden = [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  // Más de 10 respuestas distintas: las demás se agrupan en "Otras"
  const datos: Dato[] = orden.slice(0, 10).map(([etiqueta, valor]) => ({ etiqueta, valor }));
  const resto = orden.slice(10).reduce((a, [, n]) => a + n, 0);
  if (resto) datos.push({ etiqueta: `Otras (${orden.length - 10})`, valor: resto });
  return (
    <div className="space-y-2">
      <Barras datos={datos} total={valores.length} />
      <p className="text-xs text-gray-400">{valores.length} de {filas.length} encuesta(s) respondieron</p>
    </div>
  );
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

export function Tablero() {
  const { org } = useSesion();
  const conControl = org?.rol === 'admin' || org?.rol === 'editor' || org?.rol === 'lector';
  const [forms, setForms] = useState<Form[]>([]);
  const [formId, setFormId] = useState(() => (org && leer(`geoorigen.tablero.form.${org.org_id}`)) || '');
  const [periodo, setPeriodo] = useState(() => leer('geoorigen.tablero.periodo') || '30');
  const [tecnico, setTecnico] = useState('');
  const [estado, setEstado] = useState('');
  const [esquema, setEsquema] = useState<Esquema | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [recortado, setRecortado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [preguntas, setPreguntas] = useState<string[]>([]);
  const [recarga, setRecarga] = useState(0);

  const form = forms.find((f) => f.id === formId);
  const desde = desdePeriodo(periodo);

  useEffect(() => {
    if (!org) return;
    supabase.from('formularios').select('id, nombre, version_actual, estados').eq('org_id', org.org_id)
      .not('version_actual', 'is', null).order('nombre')
      .then(({ data }) => setForms((data ?? []) as Form[]));
  }, [org]);

  // Esquema del formulario elegido y sus gráficos por pregunta guardados
  useEffect(() => {
    setEsquema(null);
    if (!form || !org) { setPreguntas([]); return; }
    guardar(`geoorigen.tablero.form.${org.org_id}`, form.id);
    const g = leer(`geoorigen.tablero.preguntas.${form.id}`);
    setPreguntas(g ? JSON.parse(g) : []);
    supabase.from('formulario_versiones').select('schema').eq('formulario_id', form.id).eq('version', form.version_actual).single()
      .then(({ data }) => setEsquema((data?.schema as Esquema) ?? null));
  }, [form, org]);

  useEffect(() => {
    if (!org) return;
    let vigente = true;
    setCargando(true);
    setError('');
    let q = supabase.from('registros_panel')
      .select(`id, formulario_id, estado, creado_por, creado_en, alertas, tecnico_nombre, tecnico_email${formId ? ', datos' : ''}`)
      .eq('org_id', org.org_id).eq('eliminado', false);
    if (formId) q = q.eq('formulario_id', formId);
    if (tecnico) q = q.eq('creado_por', tecnico);
    if (estado) q = q.eq('estado', estado);
    if (desde) q = q.gte('creado_en', desde.toISOString());
    q.order('creado_en', { ascending: false }).limit(LIMITE).then(({ data, error: e }) => {
      if (!vigente) return;
      if (e) setError(mensajeError(e));
      setFilas((data ?? []) as unknown as Fila[]);
      setRecortado((data ?? []).length >= LIMITE);
      setCargando(false);
    });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, formId, tecnico, estado, periodo, recarga]);

  // ── Cálculos ──
  const tecnicos = useMemo(() => {
    const m = new Map<string, string>();
    filas.forEach((f) => m.set(f.creado_por, f.tecnico_nombre || f.tecnico_email || 'Sin nombre'));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [filas]);

  const contar = (clave: (f: Fila) => string[]) => {
    const m = new Map<string, number>();
    filas.forEach((f) => clave(f).forEach((k) => m.set(k, (m.get(k) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const estados = form?.estados ?? forms[0]?.estados ?? [];
  const etiquetaEstado = (v: string) => estados.find((e) => e.valor === v)?.etiqueta ?? v;
  const porTecnico: Dato[] = contar((f) => [f.tecnico_nombre || f.tecnico_email || 'Sin nombre']).map(([etiqueta, valor]) => ({ etiqueta, valor }));
  const porEstado: Dato[] = contar((f) => [f.estado]).map(([v, valor]) => ({ etiqueta: etiquetaEstado(v), valor }));
  const porAlerta: Dato[] = contar((f) => f.alertas).map(([a, valor]) => ({ etiqueta: ALERTAS[a]?.texto ?? a, valor, detalle: ALERTAS[a]?.detalle }));
  const porFormulario: Dato[] = contar((f) => [forms.find((x) => x.id === f.formulario_id)?.nombre ?? 'Formulario']).map(([etiqueta, valor]) => ({ etiqueta, valor }));

  const total = filas.length;
  const conAlertas = filas.filter((f) => f.alertas.length).length;
  const porRevisar = filas.filter((f) => f.estado === 'enviado').length;
  const aprobadas = filas.filter((f) => f.estado === 'aprobado').length;
  const diasPeriodo = desde ? Math.max(1, Math.ceil((Date.now() - desde.getTime()) / DIA)) : null;

  const campos = esquema ? camposConValor(esquema).filter((c) => !['foto', 'firma', 'gps', 'repetible', 'qr', 'parrafo'].includes(c.tipo)) : [];
  const fijarPreguntas = (lista: string[]) => { setPreguntas(lista); if (form) guardar(`geoorigen.tablero.preguntas.${form.id}`, JSON.stringify(lista)); };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-bold">Tablero</h1>
          <p className="text-sm text-gray-500">Cuántas encuestas, cuándo, quién y cómo van. Todo responde a los filtros.</p>
        </div>

        {/* Filtros en una fila */}
        <div className="card flex flex-wrap items-center gap-2 p-3 text-sm">
          <select className="input w-auto py-1.5" value={formId} onChange={(e) => { setFormId(e.target.value); setEstado(''); }}>
            <option value="">Todos los formularios</option>
            {forms.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
          <select className="input w-auto py-1.5" value={periodo} onChange={(e) => { setPeriodo(e.target.value); guardar('geoorigen.tablero.periodo', e.target.value); }}>
            {PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.texto}</option>)}
          </select>
          <select className="input w-auto py-1.5" value={tecnico} onChange={(e) => setTecnico(e.target.value)}>
            <option value="">Todos los técnicos</option>
            {tecnicos.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </select>
          <select className="input w-auto py-1.5" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {estados.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
          </select>
          <button className="btn-icon" title="Actualizar" onClick={() => setRecarga((n) => n + 1)}>
            <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
          {(tecnico || estado) && (
            <button className="text-xs text-gray-500 hover:underline" onClick={() => { setTecnico(''); setEstado(''); }}>Quitar filtros</button>
          )}
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {recortado && <p className="text-xs text-amber-700">Se cuentan las {LIMITE} encuestas más recientes: acorta el periodo para ver todo.</p>}

        {/* Indicadores */}
        <div className={`grid grid-cols-2 gap-3 ${conControl ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
          <Indicador titulo="Encuestas" valor={total.toLocaleString('es-CO')}
            nota={diasPeriodo ? `${compacto(total / diasPeriodo)} por día en promedio` : undefined} />
          <Indicador titulo="Por revisar (enviadas)" valor={porRevisar.toLocaleString('es-CO')} />
          <Indicador titulo="Aprobadas" valor={aprobadas.toLocaleString('es-CO')}
            nota={total ? `${Math.round((aprobadas / total) * 100)} % del total` : undefined} />
          <Indicador titulo="Técnicos con encuestas" valor={String(porTecnico.length)} />
          {conControl && (
            <Indicador titulo="Con alertas" alerta={conAlertas > 0} valor={conAlertas.toLocaleString('es-CO')}
              nota={total ? `${Math.round((conAlertas / total) * 100)} % del total` : undefined} />
          )}
        </div>

        <Panel titulo={`Encuestas ${desde && diasPeriodo && diasPeriodo > 92 ? 'por semana' : 'por día'}`}>
          <PorTiempo filas={filas} desde={desde} />
        </Panel>

        <div className="grid gap-4 md:grid-cols-2">
          <Panel titulo="Por técnico"><Barras datos={porTecnico} total={total} /></Panel>
          <Panel titulo="Por estado"><Barras datos={porEstado} total={total} /></Panel>
          {conControl && (
            <Panel titulo="Alertas de control por tipo">
              <Barras datos={porAlerta} vacio="Sin alertas en este periodo" />
            </Panel>
          )}
          {!formId && <Panel titulo="Por formulario"><Barras datos={porFormulario} total={total} /></Panel>}
        </div>

        {/* Gráficos por pregunta */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Gráficos por pregunta</h2>
              <p className="text-xs text-gray-500">
                {formId ? 'Elige preguntas del formulario para ver cómo respondieron. Se guardan para la próxima vez.' : 'Elige un formulario arriba para graficar sus preguntas.'}
              </p>
            </div>
            {formId && campos.length > 0 && (
              <select className="input w-auto py-1.5 text-sm" value=""
                onChange={(e) => e.target.value && fijarPreguntas([...preguntas.filter((p) => p !== e.target.value), e.target.value])}>
                <option value="">+ Agregar gráfico de una pregunta…</option>
                {campos.filter((c) => !preguntas.includes(c.key)).map((c) => <option key={c.key} value={c.key}>{c.etiqueta}</option>)}
              </select>
            )}
          </div>
          {formId && esquema && (
            preguntas.length === 0 ? (
              <div className="card flex flex-col items-center gap-2 p-8 text-center text-sm text-gray-400">
                <Plus className="h-6 w-6" />
                Agrega preguntas como variedad, área sembrada, ¿pertenece a asociación?… para verlas en gráficos.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {preguntas.map((k) => {
                  const c = campos.find((x) => x.key === k);
                  if (!c) return null;
                  return (
                    <Panel key={k} titulo={c.etiqueta}
                      accion={<button className="btn-icon" title="Quitar gráfico" onClick={() => fijarPreguntas(preguntas.filter((p) => p !== k))}><X className="h-4 w-4" /></button>}>
                      <GraficoPregunta campo={c} filas={filas} />
                    </Panel>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
