/* ============================================================
   supabase-client.js — Supabase Connection Configuration
   ============================================================ */

const SUPABASE_URL = 'https://vhdszynyfactpnofdrtz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uyqzNoDfKJzffQCMJO71Jg_KYyrdMeS';

// The CDN already declares the SDK namespace as a global named `supabase`.
// We must NOT redeclare it with let/const (that would throw
// "Identifier 'supabase' has already been declared" and break this whole file);
// instead we keep a reference and replace the global with our initialized client.
const supabaseLib = (typeof window !== 'undefined'
  && window.supabase
  && typeof window.supabase.createClient === 'function')
  ? window.supabase
  : null;

function initSupabase() {
  if (!supabaseLib) {
    console.error('Supabase SDK not loaded. Make sure the CDN script is included.');
    return;
  }
  supabase = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabase = supabase;
}

// The CDN script tag always runs before this file, so the SDK is available now.
// Initialize immediately so pages that query Supabase while parsing (store.js,
// admin.js) don't see the raw SDK namespace instead of the client.
initSupabase();
