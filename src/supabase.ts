import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

let cliente: SupabaseClient | null = null;

export function getSupabaseSync(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(SUPABASE_URL, SUPABASE_ANON);
  }
  return cliente;
}

// Mantener la firma async para compatibilidad con sync.ts
export async function getSupabase(): Promise<SupabaseClient | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  return getSupabaseSync();
}
