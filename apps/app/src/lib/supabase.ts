import { createClient } from '@supabase/supabase-js';

// Valores puestos al compilar (secretos de GitHub en el workflow, o .env.local)
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configurado = Boolean(url && anon);

// Con señal débil una petición puede quedarse colgada para siempre: a los 2 minutos
// se corta y la sincronización sigue con lo demás (lo no subido queda pendiente).
// (AbortController a mano: AbortSignal.timeout/any no existen en WebViews viejos)
const fetchConLimite: typeof fetch = (entrada, opciones) => {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(new Error('timeout')), 120000);
  opciones?.signal?.addEventListener('abort', () => control.abort(opciones.signal?.reason));
  return fetch(entrada, { ...opciones, signal: control.signal }).finally(() => clearTimeout(t));
};

export const supabase = createClient(url || 'http://localhost', anon || 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { fetch: fetchConLimite },
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
  // Avisos de licencia y cupo que manda el servidor: se muestran sin el código
  if (/^(LICENCIA|LIMITE_USUARIOS):/.test(m)) return m.replace(/^\w+:\s*/, '');
  if (/abort|timeout|timed out/i.test(m)) return 'La señal está muy lenta: se intentará en la próxima sincronización';
  return m;
}
