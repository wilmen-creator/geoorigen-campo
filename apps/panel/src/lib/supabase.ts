import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configurado = Boolean(url && anon);

// Si falta la configuración, la app muestra un aviso en vez de fallar en blanco
export const supabase = createClient(url || 'http://localhost', anon || 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** Mensaje de error de Supabase en palabras simples */
export function mensajeError(e: { message?: string } | null | undefined): string {
  const m = e?.message ?? 'Error desconocido';
  if (m.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos';
  if (m.includes('Email not confirmed')) return 'El correo aún no está confirmado';
  // Avisos de licencia y cupo que manda el servidor: se muestran sin el código
  if (/^(LICENCIA|LIMITE_USUARIOS):/.test(m)) return m.replace(/^\w+:\s*/, '');
  if (m.includes('violates foreign key') && m.includes('registros')) {
    return 'No se puede borrar: el formulario ya tiene registros. Desactívalo en su lugar.';
  }
  return m;
}
