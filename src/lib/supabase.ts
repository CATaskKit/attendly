import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Public client config comes from Vite env vars (safe to expose — the anon key
// is protected by Row-Level Security). Set these in `.env` locally and in the
// Vercel project settings.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// `supabase` is null until the project keys are provided. The app runs in a
// local "demo" mode until then, so deploys never break before go-live.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
