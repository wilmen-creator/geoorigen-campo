import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';

const KEY_URL = 'go_supabase_url';
const KEY_ANON = 'go_supabase_anon_key';

let cliente: SupabaseClient | null = null;

export async function obtenerConfigSupabase() {
  const url = (await Preferences.get({ key: KEY_URL })).value || import.meta.env.VITE_SUPABASE_URL || '';
  const anon = (await Preferences.get({ key: KEY_ANON })).value || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return { url, anon };
}

export async function guardarConfigSupabase(url: string, anon: string) {
  await Preferences.set({ key: KEY_URL, value: url.trim() });
  await Preferences.set({ key: KEY_ANON, value: anon.trim() });
  cliente = null; // forzar recreación con la nueva config
}

export async function getSupabase(): Promise<SupabaseClient | null> {
  const { url, anon } = await obtenerConfigSupabase();
  if (!url || !anon) return null;
  if (!cliente) {
    cliente = createClient(url, anon);
  }
  return cliente;
}
