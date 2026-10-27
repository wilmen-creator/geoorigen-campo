import { createClient } from '@supabase/supabase-js';

// Valores puestos al compilar (secretos de GitHub en el workflow, o .env.local)
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configurado = Boolean(url && anon);

export const supabase = createClient(url || 'http://localhost', anon || 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** Las cuentas sin correo entran con su usuario; por debajo es usuario@sin-correo.geoorigen.com */
export const DOMINIO_SIN_CORREO = 'sin-correo.geoorigen.com';
export const aCorreo = (usuarioOCorreo: string) => {
  const t = usuarioOCorreo.trim().toLowerCase();
  return t.includes('@') ? t : `${t}@${DOMINIO_SIN_CORREO}`;
};

export function mensajeError(e: { message?: string } | null | undefined): string {
  const m = e?.message ?? 'Error desconocido';
  if (m.includes('Invalid login credentials')) return 'Usuario o contraseña incorrectos';
  if (m.includes('Failed to fetch') || m.includes('NetworkError')) return 'Sin conexión con el servidor';
  return m;
}
