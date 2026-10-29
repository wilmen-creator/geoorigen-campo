// Plataforma (solo GeoOrigen): organizaciones clientes y sus licencias.
// Muestra conteos y espacio usado, nunca el contenido de las encuestas: para ver
// datos de una asociación existe el acceso de emergencia (solo lectura, registrado).

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Building2, Plus, X, ShieldAlert, UserPlus, Pencil, CalendarPlus } from 'lucide-react';
import { supabase, mensajeError } from '../lib/supabase.ts';
import { useSesion, estadoLicencia } from '../lib/sesion.tsx';
import { Invitar } from './Equipo.tsx';

interface OrgPlataforma {
  id: string; nombre: string; slug: string; activa: boolean; plan: string; licencia_vence: string | null;
  max_usuarios: number | null; contacto: string; notas: string; created_at: string;
  usuarios: number; admins: number; encuestas: number; ultima_encuesta: string | null; almacenamiento_bytes: number;
  soy_miembro: boolean;
}

const PLANES = [
  { valor: 'mensual', texto: 'Mensual' },
  { valor: 'anual', texto: 'Anual' },
  { valor: 'interno', texto: 'Interno (sin cobro)' },
];
// Plan gratuito de Supabase: 1 GB de archivos para todas las organizaciones juntas
const CUPO_GRATIS = 1024 ** 3;

const mb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : `${(b / 1024 ** 2).toFixed(1)} MB`);
const fecha = (t: string | null) => (t ? new Date(t.length === 10 ? `${t}T00:00:00` : t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const slugDe = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const sumarMeses = (desde: string | null, meses: number) => {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const base = desde && new Date(`${desde}T00:00:00`) > hoy ? new Date(`${desde}T00:00:00`) : hoy;
  base.setMonth(base.getMonth() + meses);
  return base.toISOString().slice(0, 10);
};

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCerrar}>
      <div className="card max-h-[90vh] w-full max-w-md overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button className="btn-icon" onClick={onCerrar}><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Crear o editar una organización y su licencia */
function EditarOrg({ org, onListo, onCerrar }: { org: OrgPlataforma | null; onListo: (id: string, nueva: boolean) => void; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(org?.nombre ?? '');
  const [slug, setSlug] = useState(org?.slug ?? '');
  const [contacto, setContacto] = useState(org?.contacto ?? '');
  const [plan, setPlan] = useState(org?.plan ?? 'mensual');
  const [vence, setVence] = useState(org ? org.licencia_vence ?? '' : sumarMeses(null, 1));
  const [max, setMax] = useState(org ? (org.max_usuarios == null ? '' : String(org.max_usuarios)) : '2');
  const [activa, setActiva] = useState(org?.activa ?? true);
  const [notas, setNotas] = useState(org?.notas ?? '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    const { data, error: err } = await supabase.rpc('plataforma_guardar_org', {
      p_id: org?.id ?? null, p_nombre: nombre, p_slug: slug || slugDe(nombre), p_activa: activa, p_plan: plan,
      p_licencia_vence: vence || null, p_max_usuarios: max ? Number(max) : null, p_contacto: contacto, p_notas: notas,
    });
    setGuardando(false);
    if (err) return setError(/duplicate|unique/i.test(err.message) ? 'Ya existe una organización con ese identificador' : mensajeError(err));
    onListo(data as string, !org);
  };

  return (
    <Modal titulo={org ? `Editar ${org.nombre}` : 'Nueva organización'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-3">
        <div>
          <label className="label">Nombre</label>
          <input className="input" required minLength={3} value={nombre} placeholder="Asociación de Caficultores…"
            onChange={(e) => { setNombre(e.target.value); if (!org) setSlug(slugDe(e.target.value)); }} />
        </div>
        <div>
          <label className="label">Identificador corto</label>
          <input className="input font-mono text-sm" value={slug} onChange={(e) => setSlug(slugDe(e.target.value))} />
        </div>
        <div>
          <label className="label">Contacto (persona, teléfono, correo)</label>
          <input className="input" value={contacto} onChange={(e) => setContacto(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Plan</label>
            <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
              {PLANES.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Máximo de usuarios</label>
            <input className="input" type="number" min={1} value={max} placeholder="Sin límite" onChange={(e) => setMax(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Licencia vigente hasta</label>
          <div className="flex gap-2">
            <input className="input" type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-xs text-gray-500">Sumar:</span>
            {[1, 3, 6, 12].map((m) => (
              <button key={m} type="button" className="btn-secondary h-7 px-2 text-xs" onClick={() => setVence(sumarMeses(vence || null, m))}>
                +{m === 12 ? '1 año' : `${m} ${m === 1 ? 'mes' : 'meses'}`}
              </button>
            ))}
            <input type="number" min={1} max={60} placeholder="meses" className="input h-7 w-20 px-2 py-0 text-xs"
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const n = Number((e.target as HTMLInputElement).value);
                if (n >= 1) { setVence(sumarMeses(vence || null, n)); (e.target as HTMLInputElement).value = ''; }
              }} />
          </div>
          <p className="mt-1 text-xs text-gray-400">Vacío = no vence. Al vencer pueden ver sus datos pero no exportarlos ni crear nada nuevo; lo capturado antes siempre se recibe.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-primary" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
          Activa (desmarcar = suspendida, solo lectura)
        </label>
        <div>
          <label className="label">Notas internas</label>
          <textarea className="input" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Modal>
  );
}

export function Plataforma() {
  const { recargar, elegirOrg } = useSesion();
  const [orgs, setOrgs] = useState<OrgPlataforma[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [modal, setModal] = useState<{ tipo: 'editar'; org: OrgPlataforma | null } | { tipo: 'admin'; org: OrgPlataforma } | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('plataforma_organizaciones');
    if (error) setAviso({ ok: false, texto: mensajeError(error) });
    const lista = (data ?? []) as OrgPlataforma[];
    setOrgs(lista);
    setCargando(false);
    return lista;
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const renovar = async (o: OrgPlataforma) => {
    const respuesta = prompt(`¿Por cuántos meses renuevas la licencia de ${o.nombre}?`, o.plan === 'anual' ? '12' : '1');
    const meses = Math.round(Number(respuesta));
    if (!respuesta || !(meses >= 1 && meses <= 60)) return;
    const nueva = sumarMeses(o.licencia_vence, meses);
    if (!confirm(`¿Renovar la licencia de ${o.nombre} hasta el ${fecha(nueva)}?`)) return;
    const { error } = await supabase.rpc('plataforma_guardar_org', {
      p_id: o.id, p_nombre: o.nombre, p_slug: o.slug, p_activa: true, p_plan: o.plan,
      p_licencia_vence: nueva, p_max_usuarios: o.max_usuarios, p_contacto: o.contacto, p_notas: o.notas,
    });
    setAviso(error ? { ok: false, texto: mensajeError(error) } : { ok: true, texto: `Licencia de ${o.nombre} renovada hasta el ${fecha(nueva)}.` });
    cargar();
  };

  const emergencia = async (o: OrgPlataforma) => {
    const motivo = prompt(`Acceso de emergencia a ${o.nombre} (solo lectura, queda registrado y lo ve su administrador).\n\n¿Motivo? (mínimo 10 caracteres)`);
    if (!motivo) return;
    const horas = Number(prompt('¿Por cuántas horas? (1 a 168)', '24'));
    if (!horas) return;
    const { error } = await supabase.rpc('acceso_emergencia', { p_org: o.id, p_motivo: motivo, p_horas: horas });
    if (error) return setAviso({ ok: false, texto: mensajeError(error) });
    await recargar();
    elegirOrg(o.id);
    setAviso({ ok: true, texto: `Acceso de emergencia a ${o.nombre} activo por ${horas} h. Elige la organización arriba a la izquierda.` });
    cargar();
  };

  const totalBytes = orgs.reduce((a, o) => a + Number(o.almacenamiento_bytes), 0);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Plataforma</h1>
            <p className="text-sm text-gray-500">Organizaciones clientes y sus licencias. Aquí solo ves conteos, no sus datos.</p>
          </div>
          <button className="btn-primary" onClick={() => setModal({ tipo: 'editar', org: null })}>
            <Plus className="h-4 w-4" /> Nueva organización
          </button>
        </div>

        {aviso && (
          <div className={`flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm ${aviso.ok ? 'bg-primary-light text-primary' : 'bg-red-50 text-red-700'}`}>
            <span>{aviso.texto}</span>
            <button onClick={() => setAviso(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="card p-4">
          <p className="text-xs text-gray-500">Fotos y archivos de todas las organizaciones</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-primary-light">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (totalBytes / CUPO_GRATIS) * 100)}%`, background: totalBytes > CUPO_GRATIS * 0.8 ? '#dc2626' : '#1d9e75' }} />
            </div>
            <span className="text-sm font-medium tabular-nums">{mb(totalBytes)} de 1 GB</span>
          </div>
          <p className="mt-1 text-xs text-gray-400">Límite del plan gratuito de Supabase. Con clientes que pagan conviene el plan Pro (100 GB y copias de seguridad diarias).</p>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-400">
              <tr>
                <th className="px-4 py-2 font-medium">Organización</th>
                <th className="px-3 py-2 font-medium">Licencia</th>
                <th className="px-3 py-2 font-medium">Usuarios</th>
                <th className="px-3 py-2 font-medium">Encuestas</th>
                <th className="px-3 py-2 font-medium">Espacio</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orgs.map((o) => {
                const lic = estadoLicencia({ ...o });
                return (
                  <tr key={o.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1.5 font-medium"><Building2 className="h-4 w-4 text-gray-400" /> {o.nombre}</p>
                      {o.contacto && <p className="text-xs text-gray-500">{o.contacto}</p>}
                      {o.notas && <p className="text-xs text-gray-400 italic">{o.notas}</p>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`badge ${!lic.vigente ? 'bg-red-100 text-red-700' : lic.dias != null && lic.dias <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-primary-light text-primary'}`}>
                        {!o.activa ? 'Suspendida' : !lic.vigente ? 'Vencida' : 'Activa'}
                      </span>
                      <p className="mt-1 text-xs text-gray-500">{PLANES.find((p) => p.valor === o.plan)?.texto ?? o.plan}{o.licencia_vence ? ` · hasta ${fecha(o.licencia_vence)}` : ' · no vence'}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {o.usuarios}{o.max_usuarios != null && ` de ${o.max_usuarios}`}
                      {Number(o.admins) === 0 && <p className="text-xs text-amber-700">Sin administrador</p>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {Number(o.encuestas).toLocaleString('es-CO')}
                      <p className="text-xs text-gray-400">{o.ultima_encuesta ? `última: ${fecha(o.ultima_encuesta)}` : 'ninguna'}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums">{mb(Number(o.almacenamiento_bytes))}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        {Number(o.admins) === 0 && (
                          <button className="btn-primary h-8 px-2 text-xs" onClick={() => setModal({ tipo: 'admin', org: o })}>
                            <UserPlus className="h-3.5 w-3.5" /> Crear administrador
                          </button>
                        )}
                        {o.licencia_vence && (
                          <button className="btn-secondary h-8 px-2 text-xs" onClick={() => renovar(o)}>
                            <CalendarPlus className="h-3.5 w-3.5" /> Renovar
                          </button>
                        )}
                        <button className="btn-secondary h-8 px-2 text-xs" onClick={() => setModal({ tipo: 'editar', org: o })}>
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                        {!o.soy_miembro && (
                          <button className="btn-secondary h-8 px-2 text-xs" title="Solo lectura, con motivo y registrado" onClick={() => emergencia(o)}>
                            <ShieldAlert className="h-3.5 w-3.5" /> Emergencia
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!cargando && orgs.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No hay organizaciones.</p>}
        </div>
      </div>

      {modal?.tipo === 'editar' && (
        <EditarOrg org={modal.org} onCerrar={() => setModal(null)}
          onListo={(id, nueva) => {
            setModal(null);
            cargar().then((lista) => {
              const o = lista.find((x) => x.id === id);
              // Recién creada: se sigue directo con su administrador
              if (nueva && o) {
                setAviso({ ok: true, texto: 'Organización creada. Ahora crea su administrador.' });
                setModal({ tipo: 'admin', org: o });
              } else setAviso({ ok: true, texto: 'Cambios guardados.' });
            });
          }} />
      )}
      {modal?.tipo === 'admin' && (
        <Invitar orgId={modal.org.id} primerAdmin onCerrar={() => setModal(null)}
          onListo={(texto) => { setModal(null); setAviso({ ok: true, texto: `${modal.org.nombre}: ${texto}` }); cargar(); }} />
      )}
    </div>
  );
}
