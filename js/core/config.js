// BSTM Configuration - Production
export const CONFIG = {
  API: {
    SUPABASE_URL: import.meta.env?.VITE_SUPABASE_URL || 'https://your-project.supabase.co',
    SUPABASE_KEY: import.meta.env?.VITE_SUPABASE_ANON_KEY || 'your-key',
    PAYSTACK_PUBLIC: import.meta.env?.VITE_PAYSTACK_PUBLIC_KEY || 'pk_live_xxx',
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
