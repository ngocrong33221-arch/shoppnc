/* ============================================================
   supabase-client.js — Supabase Connection Configuration
   ============================================================ */

const SUPABASE_URL = 'https://vhdszynyfactpnofdrtz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uyqzNoDfKJzffQCMJO71Jg_KYyrdMeS';

// The CDN exposes the SDK namespace as the global `window.supabase`.
// Capture it BEFORE we shadow the name with our own client variable below.
const supabaseLib = (typeof window !== 'undefined'
  && window.supabase
  && typeof window.supabase.createClient === 'function')
  ? window.supabase
  : null;

// The Supabase client will be initialized globally once the CDN script is loaded.
let supabase = null;

function initSupabase() {
  if (supabaseLib) {
    supabase = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error('Supabase SDK not loaded. Make sure the CDN script is included.');
  }
}

// Initialize when this script loads (assuming CDN is loaded before)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupabase);
} else {
  initSupabase();
}
