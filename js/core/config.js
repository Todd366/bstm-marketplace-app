// BSTM Configuration - Production
export const CONFIG = {
  // API Configuration
  API: {
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://your-project.supabase.co',
    SUPABASE_KEY: process.env.SUPABASE_ANON_KEY || 'your-key',
    PAYSTACK_PUBLIC: process.env.PAYSTACK_PUBLIC_KEY || 'pk_live_xxx',
  },

  // App Settings
  APP: {
    NAME: 'BSTM Digital Mall',
    VERSION: '2.0.0',
    ENVIRONMENT: 'production',
  },

  // Feature Flags
  FEATURES: {
    OFFLINE_MODE: true,
    PWA_INSTALL: true,
    DARK_MODE: true,
    VOICE_SEARCH: true,
    ANALYTICS: true,
  },

  // Marketplace Settings
  MARKETPLACE: {
    FEE_PERCENT: 5,
    MIN_WITHDRAWAL: 1000, // P1000 minimum
    THB_TO_BWP: 10, // 1 THB = P10
    REWARD_PERCENT: 1, // 1% of purchase value
  },

  // CabLink Settings
  CABLINK: {
    BASE_FARE: 5, // P5
    PER_KM: 8, // P8 per km
    THB_PER_RIDE: 0.8,
  },

  // Paystack Configuration
  PAYSTACK: {
    PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY || 'pk_live_xxx',
    SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || 'sk_live_xxx',
    CURRENCY: 'BWP',
  },

  // Telegram Bot
  TELEGRAM: {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  },

  // URLs
  URLs: {
    HOMEPAGE: '/',
    LOGIN: '/login.html',
    MARKETPLACE: '/marketplace.html',
    SELLER_DASHBOARD: '/seller-dashboard.html',
    BUYER_DASHBOARD: '/buyer-dashboard.html',
    CABLINK: 'https://cablink.bstm.bw',
    ROOM22: '/room22-farm.html',
  },
};

// Runtime Config Loader
export function loadConfig() {
  if (window.BSTM_CONFIG) {
    return { ...CONFIG, ...window.BSTM_CONFIG };
  }
  return CONFIG;
}
