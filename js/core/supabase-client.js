import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ============================================
// SUPABASE CLIENT (SINGLE SOURCE OF TRUTH)
// ============================================

// Safe environment access helper
function getEnv(key) {
  try {
    return typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env[key];
  } catch (e) {
    return undefined;
  }
}

// ============================================
// CONFIG
// ============================================

const SUPABASE_URL =
  getEnv("VITE_SUPABASE_URL") ||
  window?.BSTM_CONFIG?.SUPABASE_URL ||
  "https://tvtfxkavjqvurdezhyvu.supabase.co";

const SUPABASE_ANON_KEY =
  getEnv("VITE_SUPABASE_ANON_KEY") ||
  window?.BSTM_CONFIG?.SUPABASE_ANON_KEY ||
  "sb_publishable_xlZ3YKF6h5XBMhARWkE9_g_PVudo5r8";

// ============================================
// CLIENT
// ============================================

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// DEBUG (DEV ONLY)
// ============================================

const MODE = getEnv("MODE");

if (MODE === "development") {
  console.log(
    "🔹 Supabase initialized:",
    SUPABASE_URL.split(".")[0] + "..."
  );
}
