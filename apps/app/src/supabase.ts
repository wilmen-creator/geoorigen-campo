import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';

// Valores baked-in al compilar (GitHub Secrets en el workflow)
const ENV_URL  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const ENV_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const KEY_URL  = 'go_supabase_url';
const KEY_ANON = 'go_supabase_anon_key';

let cliente: SupabaseClient | null = null;

export async function getConfig(): Promise<{ url: string; anon: string }> {
  // Prioridad: variable de entorno del build → valor guardado en Preferences
  const url  = ENV_URL  || (await Preferences.get({ key: KEY_URL  })).value || '';
  const anon = ENV_ANON || (await Preferences.get({ key: KEY_ANON })).value || '';
  return { url, anon };
}

export async function guardarConfig(url: string, anon: string) {
  await Preferences.set({ key: KEY_URL,  value: url.trim() });
  await Preferences.set({ key: KEY_ANON, value: anon.trim() });
  cliente = null;
}

export async function getSupabase(): Promise<SupabaseClient | null> {
  const { url, anon } = await getConfig();
  if (!url || !anon) return null;
  if (!cliente) cliente = createClient(url, anon);
  return cliente;
}

// ¿Las variables de entorno ya vienen baked-in desde el build?
export const configEnBuild = !!(ENV_URL && ENV_ANON);
