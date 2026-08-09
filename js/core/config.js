// BSTM Configuration - Production
// NOTE: This is a plain static site with no bundler, so `import.meta.env`
// is never populated in the browser (that only exists under Vite/similar).
// The Supabase anon/publishable key is safe to ship client-side by design —
// it is rate-limited and access is enforced by Postgres RLS policies, not
// by keeping this key secret. Never put the SERVICE ROLE key here.
export const CONFIG = {
  API: {
    SUPABASE_URL: 'https://tvtfxkavjqvurdezhyvu.supabase.co',
    SUPABASE_KEY: 'sb_publishable_xlZ3YKF6h5XBMhARWkE9_g_PVudo5r8',
    PAYSTACK_PUBLIC: window.BSTM_CONFIG?.PAYSTACK_PUBLIC_KEY || 'pk_live_xxx',
  },
  APP: {
    NAME: 'BSTM Digital Mall',
    VERSION: '2.0.0',
    ENVIRONMENT: 'production',
  },
  FEATURES: {
    OFFLINE_MODE: true,
    PWA_INSTALL: true,
    DARK_MODE: true,
    VOICE_SEARCH: true,
    ANALYTICS: true,
  },
  MARKETPLACE: {
    FEE_PERCENT: 5,
    MIN_WITHDRAWAL: 1000,
    THB_TO_BWP: 10,
    REWARD_PERCENT: 1,
  },
  CABLINK: {
    BASE_FARE: 5,
    PER_KM: 8,
    THB_PER_RIDE: 0.8,
  },
  PAYSTACK: {
    PUBLIC_KEY: import.meta.env?.VITE_PAYSTACK_PUBLIC_KEY || 'pk_live_xxx',
    CURRENCY: 'BWP',
  },
};

export function loadConfig() {
  if (window.BSTM_CONFIG) {
    return { ...CONFIG, ...window.BSTM_CONFIG };
  }
  return CONFIG;
}
