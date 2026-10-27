// Equipo de la organización: invitar, roles, activar, contraseñas y formularios asignados.

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { UserPlus, KeyRound, ClipboardList, UserX, X, Power, ShieldAlert } from 'lucide-react';
import { supabase, mensajeError } from '../lib/supabase.ts';
import { useSesion, type Rol } from '../lib/sesion.tsx';

const DOMINIO_SIN_CORREO = 'sin-correo.geoorigen.com';

const ROLES: { rol: Rol; nombre: string; descripcion: string }[] = [
  { rol: 'admin', nombre: 'Administrador', descripcion: 'Todo: equipo, formularios, revisar y exportar' },
  { rol: 'editor', nombre: 'Editor', descripcion: 'Diseña formularios y revisa registros' },
  { rol: 'colaborador', nombre: 'Colaborador', descripcion: 'Llena encuestas en campo con la app' },
  { rol: 'lector', nombre: 'Lector', descripcion: 'Solo ve y exporta (auditor, comprador)' },
];
const nombreRol = (r: Rol) => ROLES.find((x) => x.rol === r)?.nombre ?? r;

interface Miembro {
  user_id: string;
  rol: Rol;
  activo: boolean;
  expira_en: string | null;
  motivo: string | null;
  created_at: string;
  nombre: string;
  email: string;
  asignados: number;
}

interface FormularioCorto { id: string; nombre: string; icono: string; activo: boolean }

/** Correo visible: las cuentas sin correo se muestran como "usuario" */
function identificacion(email: string) {
  return email.endsWith(`@${DOMINIO_SIN_CORREO}`)
    ? { texto: `usuario: ${email.split('@')[0]}`, sinCorreo: true }
    : { texto: email, sinCorreo: false };
}

async function llamarFuncion(cuerpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('invitar-miembro', { body: cuerpo });
  if (error) {
    // El mensaje útil viene en el cuerpo de la respuesta
    const detalle = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detalle?.error ?? error.message);
  }
  return data as { ok: boolean; email?: string; invitado?: boolean };
}

// ── Modal genérico ────────────────────────────────────────────────────────────

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
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

// ── Invitar ───────────────────────────────────────────────────────────────────

function Invitar({ orgId, onListo, onCerrar }: { orgId: string; onListo: (aviso: string) => void; onCerrar: () => void }) {
  const [nombre, setNombre] = useState('');
  const [modo, setModo] = useState<'correo' | 'clave' | 'usuario'>('correo');
  const [correo, setCorreo] = useState('');
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [rol, setRol] = useState<Rol>('colaborador');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const r = await llamarFuncion({
        accion: 'invitar', org_id: orgId, rol, nombre,
        ...(modo === 'usuario' ? { usuario, password: clave } : { email: correo }),
        ...(modo === 'clave' ? { password: clave } : {}),
      });
      onListo(r.invitado
        ? `Se envió una invitación a ${r.email}. Tendrá que abrir el enlace y crear su contraseña.`
        : modo === 'usuario'
          ? `Listo. Entra con el usuario "${usuario}" y la contraseña que le diste.`
          : `${nombre} ya forma parte del equipo.`);
    } catch (err) {
      setError((err as Error).message);
    }
    setEnviando(false);
  };

  return (
    <Modal titulo="Agregar persona" onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-3">
        <div>
          <label className="label">Nombre completo</label>
          <input className="input" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>

        <div>
          <label className="label">¿Cómo va a entrar?</label>
          <div className="space-y-1.5 text-sm">
            {([
              ['correo', 'Con su correo: le llega una invitación'],
              ['clave', 'Con su correo y una contraseña que le doy yo'],
              ['usuario', 'Sin correo: le creo un usuario y contraseña'],
            ] as const).map(([v, t]) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" className="accent-primary" checked={modo === v} onChange={() => setModo(v)} /> {t}
              </label>
            ))}
          </div>
        </div>

        {modo === 'usuario' ? (
          <div>
            <label className="label">Usuario</label>
            <input className="input font-mono" required value={usuario} placeholder="ej: juan.perez"
              onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} />
          </div>
        ) : (
          <div>
            <label className="label">Correo</label>
            <input className="input" type="email" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </div>
        )}

        {modo !== 'correo' && (
          <div>
            <label className="label">Contraseña (mínimo 8)</label>
            <input className="input" type="text" required minLength={8} value={clave} onChange={(e) => setClave(e.target.value)}
              autoComplete="new-password" />
            <p className="mt-1 text-xs text-gray-400">Entrégasela en persona o por un canal privado.</p>
          </div>
        )}

        <div>
          <label className="label">Rol</label>
          <div className="space-y-1">
            {ROLES.map((r) => (
              <label key={r.rol} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${rol === r.rol ? 'border-primary bg-primary-light/40' : 'border-gray-100'}`}>
                <input type="radio" className="mt-1 accent-primary" checked={rol === r.rol} onChange={() => setRol(r.rol)} />
                <span>
                  <span className="block text-sm font-medium">{r.nombre}</span>
                  <span className="block text-xs text-gray-500">{r.descripcion}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={enviando}>{enviando ? 'Agregando…' : 'Agregar al equipo'}</button>
      </form>
    </Modal>
  );
}

// ── Cambiar contraseña ────────────────────────────────────────────────────────

function CambiarClave({ orgId, miembro, onListo, onCerrar }: {
  orgId: string; miembro: Miembro; onListo: (aviso: string) => void; onCerrar: () => void;
}) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await llamarFuncion({ accion: 'cambiar_clave', org_id: orgId, user_id: miembro.user_id, password: clave });
      onListo(`Contraseña de ${miembro.nombre || miembro.email} cambiada.`);
    } catch (err) {
      setError((err as Error).message);
    }
    setEnviando(false);
  };
  return (
    <Modal titulo={`Contraseña de ${miembro.nombre || miembro.email}`} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-3">
        <input className="input" type="text" required minLength={8} value={clave} placeholder="Contraseña nueva (mínimo 8)"
          onChange={(e) => setClave(e.target.value)} autoComplete="new-password" />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full" disabled={enviando}>{enviando ? 'Guardando…' : 'Cambiar contraseña'}</button>
      </form>
    </Modal>
  );
}

// ── Formularios asignados ─────────────────────────────────────────────────────

function Asignaciones({ miembro, formularios, onListo, onCerrar }: {
  miembro: Miembro; formularios: FormularioCorto[]; onListo: (aviso: string) => void; onCerrar: () => void;
}) {
  // Lo que hay guardado y lo que se está marcando; solo se guarda al tocar el botón
  const [guardados, setGuardados] = useState<Set<string>>(new Set());
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [conAsignacion, setConAsignacion] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const ids = formularios.map((f) => f.id);
    if (ids.length === 0) return;
    supabase.from('formulario_asignaciones').select('formulario_id, user_id').in('formulario_id', ids)
      .then(({ data }) => {
        const filas = data ?? [];
        const mios = new Set(filas.filter((f) => f.user_id === miembro.user_id).map((f) => f.formulario_id));
        setGuardados(mios);
        setMarcados(new Set(mios));
        setConAsignacion(new Set(filas.map((f) => f.formulario_id)));
      });
  }, [formularios, miembro.user_id]);

  const alternar = (formId: string) => setMarcados((m) => {
    const copia = new Set(m);
    if (copia.has(formId)) copia.delete(formId); else copia.add(formId);
    return copia;
  });

  const agregar = [...marcados].filter((id) => !guardados.has(id));
  const quitar = [...guardados].filter((id) => !marcados.has(id));
  const hayCambios = agregar.length + quitar.length > 0;

  const guardar = async () => {
    setGuardando(true);
    setError('');
    const r1 = agregar.length
      ? await supabase.from('formulario_asignaciones').insert(agregar.map((formulario_id) => ({ formulario_id, user_id: miembro.user_id })))
      : { error: null };
    const r2 = quitar.length
      ? await supabase.from('formulario_asignaciones').delete().eq('user_id', miembro.user_id).in('formulario_id', quitar)
      : { error: null };
    setGuardando(false);
    const err = r1.error ?? r2.error;
    if (err) return setError(mensajeError(err));
    const nombre = miembro.nombre || miembro.email;
    onListo(marcados.size === 0
      ? `${nombre} no tiene formularios asignados: verá los que no están asignados a nadie.`
      : `Asignaciones guardadas: ${nombre} tiene ${marcados.size} formulario(s).`);
  };

  return (
    <Modal titulo={`Formularios de ${miembro.nombre || miembro.email}`} onCerrar={onCerrar}>
      <p className="mb-3 text-xs text-gray-500">
        Un formulario <strong>sin nadie asignado</strong> lo ven todos los colaboradores. En cuanto asignas a
        alguien, solo lo ven las personas asignadas.
      </p>
      {formularios.length === 0 && <p className="text-sm text-gray-400">No hay formularios todavía.</p>}
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
        {formularios.map((f) => (
          <label key={f.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${f.activo ? '' : 'opacity-50'}`}>
            <input type="checkbox" className="accent-primary" checked={marcados.has(f.id)} onChange={() => alternar(f.id)} />
            <span className="text-lg">{f.icono}</span>
            <span className="flex-1 text-sm">{f.nombre}</span>
            {marcados.has(f.id) !== guardados.has(f.id) && <span className="badge bg-amber-50 text-amber-700">sin guardar</span>}
            {!conAsignacion.has(f.id) && <span className="badge bg-gray-100 text-gray-500">todos lo ven</span>}
            {!f.activo && <span className="badge bg-gray-100 text-gray-500">inactivo</span>}
          </label>
        ))}
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCerrar}>Cancelar</button>
        <button className="btn-primary" onClick={guardar} disabled={guardando || !hayCambios}>
          {guardando ? 'Guardando…' : 'Guardar asignaciones'}
        </button>
      </div>
    </Modal>
  );
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

export function Equipo() {
  const { org, sesion } = useSesion();
  const esAdmin = org?.rol === 'admin' && !org.expira_en;
  const puedeAsignar = (org?.rol === 'admin' || org?.rol === 'editor') && !org?.expira_en;
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [formularios, setFormularios] = useState<FormularioCorto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [modal, setModal] = useState<
    | { tipo: 'invitar' }
    | { tipo: 'clave'; m: Miembro }
    | { tipo: 'asignar'; m: Miembro }
    | null
  >(null);

  const cargar = useCallback(async () => {
    if (!org) return;
    const [{ data: ms, error: e1 }, { data: fs }] = await Promise.all([
      supabase.from('miembros').select('user_id, rol, activo, expira_en, motivo, created_at').eq('org_id', org.org_id),
      supabase.from('formularios').select('id, nombre, icono, activo').eq('org_id', org.org_id).order('nombre'),
    ]);
    if (e1) setAviso({ ok: false, texto: mensajeError(e1) });
    const ids = (ms ?? []).map((m) => m.user_id);
    const formIds = (fs ?? []).map((f) => f.id);
    const [{ data: ps }, { data: as }] = await Promise.all([
      ids.length ? supabase.from('perfiles').select('user_id, nombre, email').in('user_id', ids) : Promise.resolve({ data: [] }),
      formIds.length ? supabase.from('formulario_asignaciones').select('formulario_id, user_id').in('formulario_id', formIds) : Promise.resolve({ data: [] }),
    ]);
    const perfil = new Map((ps ?? []).map((p) => [p.user_id, p]));
    const cuenta = new Map<string, number>();
    (as ?? []).forEach((a) => cuenta.set(a.user_id, (cuenta.get(a.user_id) ?? 0) + 1));
    const orden: Record<Rol, number> = { admin: 0, editor: 1, lector: 2, colaborador: 3 };
    setMiembros(
      (ms ?? []).map((m) => ({
        ...(m as Omit<Miembro, 'nombre' | 'email' | 'asignados'>),
        nombre: perfil.get(m.user_id)?.nombre ?? '',
        email: perfil.get(m.user_id)?.email ?? '',
        asignados: cuenta.get(m.user_id) ?? 0,
      })).sort((a, b) => orden[a.rol] - orden[b.rol] || (a.nombre || a.email).localeCompare(b.nombre || b.email)),
    );
    setFormularios((fs ?? []) as FormularioCorto[]);
    setCargando(false);
  }, [org]);

  useEffect(() => { cargar(); }, [cargar]);

  const adminsActivos = miembros.filter((m) => m.rol === 'admin' && m.activo && !m.expira_en).length;

  const cambiar = async (m: Miembro, cambio: Partial<Pick<Miembro, 'rol' | 'activo'>>) => {
    if (!org) return;
    const dejaDeSerAdmin = m.rol === 'admin' && !m.expira_en && (cambio.rol && cambio.rol !== 'admin' || cambio.activo === false);
    if (dejaDeSerAdmin && adminsActivos <= 1) {
      return setAviso({ ok: false, texto: 'Debe quedar al menos un administrador activo en la organización.' });
    }
    if (m.user_id === sesion?.user.id && dejaDeSerAdmin && !confirm('Vas a quitarte el rol de administrador. ¿Seguro?')) return;
    const { error } = await supabase.from('miembros').update(cambio).eq('org_id', org.org_id).eq('user_id', m.user_id);
    if (error) return setAviso({ ok: false, texto: mensajeError(error) });
    setAviso(null);
    cargar();
  };

  const quitar = async (m: Miembro) => {
    if (!org) return;
    if (m.rol === 'admin' && !m.expira_en && adminsActivos <= 1) {
      return setAviso({ ok: false, texto: 'No puedes quitar al único administrador.' });
    }
    if (!confirm(`¿Quitar a ${m.nombre || m.email} de ${org.organizacion.nombre}? Sus registros se conservan.`)) return;
    const { error } = await supabase.from('miembros').delete().eq('org_id', org.org_id).eq('user_id', m.user_id);
    if (error) return setAviso({ ok: false, texto: mensajeError(error) });
    cargar();
  };

  // Cada persona puede cambiar su propio nombre
  const cambiarMiNombre = async (m: Miembro) => {
    const nombre = prompt('Tu nombre completo', m.nombre)?.trim();
    if (!nombre || nombre === m.nombre) return;
    const { error } = await supabase.from('perfiles').update({ nombre }).eq('user_id', m.user_id);
    if (error) return setAviso({ ok: false, texto: mensajeError(error) });
    cargar();
  };

  const listo = (texto: string) => { setModal(null); setAviso({ ok: true, texto }); cargar(); };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Equipo</h1>
            <p className="text-sm text-gray-500">Quién trabaja en {org?.organizacion.nombre} y qué puede hacer.</p>
          </div>
          {esAdmin && (
            <button className="btn-primary" onClick={() => setModal({ tipo: 'invitar' })}>
              <UserPlus className="h-4 w-4" /> Agregar persona
            </button>
          )}
        </div>

        {aviso && (
          <div className={`flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm ${aviso.ok ? 'bg-primary-light text-primary' : 'bg-red-50 text-red-700'}`}>
            <span>{aviso.texto}</span>
            <button onClick={() => setAviso(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {cargando ? (
          <p className="text-sm text-gray-400">Cargando…</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left text-xs tracking-wide text-gray-400 uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Persona</th>
                  <th className="px-4 py-2 font-medium">Rol</th>
                  <th className="px-4 py-2 font-medium">Formularios</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {miembros.map((m) => {
                  const id = identificacion(m.email);
                  const yo = m.user_id === sesion?.user.id;
                  return (
                    <tr key={m.user_id} className={m.activo ? '' : 'opacity-50'}>
                      <td className="px-4 py-2.5">
                        {yo ? (
                          <button className="font-medium hover:text-primary hover:underline" title="Cambiar mi nombre" onClick={() => cambiarMiNombre(m)}>
                            {m.nombre || 'Poner mi nombre'} <span className="text-xs text-gray-400">(tú)</span>
                          </button>
                        ) : (
                          <p className="font-medium">{m.nombre || '(sin nombre)'}</p>
                        )}
                        <p className={`text-xs ${id.sinCorreo ? 'font-mono text-accent' : 'text-gray-400'}`}>{id.texto}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        {m.expira_en ? (
                          <span className="badge bg-amber-50 text-amber-700" title={m.motivo ?? ''}>
                            <ShieldAlert className="mr-1 h-3 w-3" /> Emergencia hasta {new Date(m.expira_en).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        ) : esAdmin ? (
                          <select className="input w-36 py-1" value={m.rol} onChange={(e) => cambiar(m, { rol: e.target.value as Rol })}>
                            {ROLES.map((r) => <option key={r.rol} value={r.rol}>{r.nombre}</option>)}
                          </select>
                        ) : (
                          nombreRol(m.rol)
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {m.rol === 'colaborador' ? (
                          puedeAsignar ? (
                            <button className="flex items-center gap-1 text-primary hover:underline" onClick={() => setModal({ tipo: 'asignar', m })}>
                              <ClipboardList className="h-3.5 w-3.5" /> {m.asignados ? `${m.asignados} asignado(s)` : 'Asignar'}
                            </button>
                          ) : `${m.asignados} asignado(s)`
                        ) : (
                          <span className="text-xs text-gray-400">ve todos</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`badge ${m.activo ? 'bg-primary-light text-primary' : 'bg-gray-100 text-gray-500'}`}>
                          {m.activo ? 'Activo' : 'Desactivado'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {esAdmin && !m.expira_en && (
                          <div className="flex justify-end gap-1">
                            {!yo && (
                              <button className="btn-icon" title="Cambiar contraseña" onClick={() => setModal({ tipo: 'clave', m })}>
                                <KeyRound className="h-4 w-4" />
                              </button>
                            )}
                            <button className="btn-icon" title={m.activo ? 'Desactivar (no podrá entrar ni sincronizar)' : 'Activar'}
                              onClick={() => cambiar(m, { activo: !m.activo })}>
                              <Power className="h-4 w-4" />
                            </button>
                            {!yo && (
                              <button className="btn-icon hover:text-red-600" title="Quitar de la organización" onClick={() => quitar(m)}>
                                <UserX className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.tipo === 'invitar' && org && <Invitar orgId={org.org_id} onListo={listo} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'clave' && org && <CambiarClave orgId={org.org_id} miembro={modal.m} onListo={listo} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'asignar' && (
        <Asignaciones miembro={modal.m} formularios={formularios} onListo={listo} onCerrar={() => setModal(null)} />
      )}
    </div>
  );
}
