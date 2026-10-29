// Sesión del usuario y organización activa.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';

export type Rol = 'admin' | 'editor' | 'colaborador' | 'lector';

export interface Membresia {
  org_id: string;
  rol: Rol;
  expira_en: string | null;
  organizacion: {
    id: string; nombre: string; slug: string;
    /** Licencia: activa, fecha de vencimiento (null = no vence) y máximo de usuarios (null = sin límite) */
    activa: boolean; licencia_vence: string | null; max_usuarios: number | null;
  };
}

/** Estado de la licencia de una organización y días que le quedan */
export function estadoLicencia(o: Membresia['organizacion']): { vigente: boolean; dias: number | null; texto: string } {
  if (!o.activa) return { vigente: false, dias: null, texto: 'Organización suspendida: puedes ver tus datos, pero no exportarlos ni crear nada nuevo. Contacta a GeoOrigen.' };
  if (!o.licencia_vence) return { vigente: true, dias: null, texto: '' };
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(`${o.licencia_vence}T00:00:00`).getTime() - hoy.getTime()) / 86400000);
  const fecha = new Date(`${o.licencia_vence}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  if (dias < 0) return { vigente: false, dias, texto: `La licencia venció el ${fecha}: puedes ver tus datos, pero no exportarlos ni crear nada nuevo. Contacta a GeoOrigen para renovarla.` };
  return { vigente: true, dias, texto: dias <= 7 ? `La licencia vence el ${fecha} (${dias === 0 ? 'hoy' : `en ${dias} día(s)`}).` : '' };
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

// Se lee al cargar, antes de que el cliente de Supabase limpie el enlace
const LLEGO_POR_INVITACION = /[#&?]type=invite\b/.test(window.location.hash + window.location.search);
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
  // Quien llega desde el correo de invitación aún no tiene contraseña: se le pide crearla
  const [recuperando, setRecuperando] = useState(() => LLEGO_POR_INVITACION);
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
      .select('org_id, rol, expira_en, organizacion:organizaciones(id, nombre, slug, activa, licencia_vence, max_usuarios)')
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
    let usuarioCargado: string | undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true);
      setSesion(s);
      // Supabase avisa también al recuperar el foco o renovar el token:
      // solo se recargan las organizaciones si cambió el usuario.
      if (s?.user.id === usuarioCargado) return;
      usuarioCargado = s?.user.id;
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

/**
 * ¿Puede exportar o descargar datos (Excel, CSV, KML, QR)? Con la licencia vencida o
 * suspendida los datos se ven pero no se descargan. El acceso de emergencia de
 * GeoOrigen tampoco descarga: solo consulta.
 */
export function puedeExportar(org: Membresia | null): { si: boolean; motivo: string } {
  if (!org) return { si: false, motivo: '' };
  if (org.expira_en) return { si: false, motivo: 'El acceso de emergencia es solo de consulta: no permite descargar datos.' };
  if (!estadoLicencia(org.organizacion).vigente) {
    return { si: false, motivo: 'La licencia está vencida o suspendida: puedes ver los datos, pero no descargarlos. Contacta a GeoOrigen para renovarla.' };
  }
  return { si: true, motivo: '' };
}

/** ¿El rol actual puede diseñar formularios? */
export function puedeEditar(rol: Rol | undefined): boolean {
  return rol === 'admin' || rol === 'editor';
}
