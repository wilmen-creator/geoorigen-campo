// Sesión del colaborador y organización activa.
// La lista de organizaciones se guarda en el celular para poder trabajar sin señal.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';

export interface Membresia {
  org_id: string;
  rol: 'admin' | 'editor' | 'colaborador' | 'lector';
  nombre: string;
}

interface ContextoSesion {
  sesion: Session | null;
  cargando: boolean;
  membresias: Membresia[];
  org: Membresia | null;
  elegirOrg: (id: string) => void;
  salir: () => Promise<void>;
  recargarMembresias: () => Promise<void>;
}

const Contexto = createContext<ContextoSesion | null>(null);
const CLAVE_ORG = 'geoorigen.app.org';
const CLAVE_MEMB = 'geoorigen.app.membresias';

const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const escribir = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);
  const [membresias, setMembresias] = useState<Membresia[]>(() => {
    try { return JSON.parse(leer(CLAVE_MEMB) ?? '[]'); } catch { return []; }
  });
  const [orgId, setOrgId] = useState<string | null>(leer(CLAVE_ORG));

  const recargarMembresias = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from('miembros')
      .select('org_id, rol, expira_en, organizacion:organizaciones(nombre)')
      .eq('user_id', u.user.id)
      .eq('activo', true);
    if (error) return;  // sin señal: se sigue con la lista guardada
    const lista = ((data ?? []) as unknown as { org_id: string; rol: Membresia['rol']; expira_en: string | null; organizacion: { nombre: string } }[])
      .filter((m) => !m.expira_en)
      .map((m) => ({ org_id: m.org_id, rol: m.rol, nombre: m.organizacion?.nombre ?? '' }));
    setMembresias(lista);
    escribir(CLAVE_MEMB, JSON.stringify(lista));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
      if (data.session) recargarMembresias();
    });
    let usuario: string | undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSesion(s);
      if (s && s.user.id !== usuario) setTimeout(() => { recargarMembresias(); }, 0);
      usuario = s?.user.id;
    });
    return () => sub.subscription.unsubscribe();
  }, [recargarMembresias]);

  const org = membresias.find((m) => m.org_id === orgId) ?? (membresias.length === 1 ? membresias[0] : null);

  return (
    <Contexto.Provider value={{
      sesion, cargando, membresias, org,
      elegirOrg: (id) => { escribir(CLAVE_ORG, id); setOrgId(id); },
      salir: async () => {
        await supabase.auth.signOut();
        setMembresias([]);
        escribir(CLAVE_MEMB, '[]');
      },
      recargarMembresias,
    }}>
      {children}
    </Contexto.Provider>
  );
}

export function useSesion() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useSesion fuera de ProveedorSesion');
  return c;
}
