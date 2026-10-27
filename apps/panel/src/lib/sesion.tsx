// Sesión del usuario y organización activa.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';

export type Rol = 'admin' | 'editor' | 'colaborador' | 'lector';

export interface Membresia {
  org_id: string;
  rol: Rol;
  expira_en: string | null;
  organizacion: { id: string; nombre: string; slug: string };
}

interface ContextoSesion {
  sesion: Session | null;
  cargando: boolean;
  /** true cuando el usuario llegó desde el enlace de "olvidé mi contraseña" */
  recuperando: boolean;
  terminarRecuperacion: () => void;
  membresias: Membresia[];
  org: Membresia | null;
  elegirOrg: (orgId: string) => void;
  esPlataformaAdmin: boolean;
  salir: () => Promise<void>;
  recargar: () => Promise<void>;
}

const Contexto = createContext<ContextoSesion | null>(null);
const CLAVE_ORG = 'geoorigen.panel.org';

function leerOrgGuardada(): string | null {
  try { return localStorage.getItem(CLAVE_ORG); } catch { return null; }
}
function guardarOrg(id: string) {
  try { localStorage.setItem(CLAVE_ORG, id); } catch { /* navegador sin almacenamiento */ }
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);
  const [recuperando, setRecuperando] = useState(false);
  const [membresias, setMembresias] = useState<Membresia[]>([]);
  const [orgId, setOrgId] = useState<string | null>(leerOrgGuardada());
  const [esPlataformaAdmin, setEsPlataformaAdmin] = useState(false);

  const cargarMembresias = useCallback(async (s: Session | null) => {
    if (!s) {
      setMembresias([]);
      setEsPlataformaAdmin(false);
      return;
    }
    const { data } = await supabase
      .from('miembros')
      .select('org_id, rol, expira_en, organizacion:organizaciones(id, nombre, slug)')
      .eq('user_id', s.user.id)
      .eq('activo', true);
    const ahora = Date.now();
    const vigentes = ((data ?? []) as unknown as Membresia[])
      .filter((m) => m.organizacion && (!m.expira_en || new Date(m.expira_en).getTime() > ahora))
      .sort((a, b) => a.organizacion.nombre.localeCompare(b.organizacion.nombre));
    setMembresias(vigentes);

    const { data: soyAdmin } = await supabase.rpc('soy_plataforma_admin');
    setEsPlataformaAdmin(soyAdmin === true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSesion(data.session);
      await cargarMembresias(data.session);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true);
      setSesion(s);
      // Fuera del callback para no bloquear el cliente de auth
      setTimeout(() => { cargarMembresias(s); }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [cargarMembresias]);

  const org = membresias.find((m) => m.org_id === orgId) ?? (membresias.length === 1 ? membresias[0] : null);

  const valor: ContextoSesion = {
    sesion,
    cargando,
    recuperando,
    terminarRecuperacion: () => setRecuperando(false),
    membresias,
    org,
    elegirOrg: (id) => { guardarOrg(id); setOrgId(id); },
    esPlataformaAdmin,
    salir: async () => { await supabase.auth.signOut(); setOrgId(null); },
    recargar: () => cargarMembresias(sesion),
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ContextoSesion {
  const c = useContext(Contexto);
  if (!c) throw new Error('useSesion fuera de ProveedorSesion');
  return c;
}

/** ¿El rol actual puede diseñar formularios? */
export function puedeEditar(rol: Rol | undefined): boolean {
  return rol === 'admin' || rol === 'editor';
}
