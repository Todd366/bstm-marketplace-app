import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ============================================
// SUPABASE CLIENT (SINGLE SOURCE)
// ============================================

// Allow environment overrides OR fallback values
const SUPABASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  window.BSTM_CONFIG?.SUPABASE_URL ||
  "https://tvtfxkavjqvurdezhyvu.supabase.co";

const SUPABASE_ANON_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  window.BSTM_CONFIG?.SUPABASE_ANON_KEY ||
  "sb_publishable_xlZ3YKF6h5XBMhARWkE9_g_PVudo5r8";

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Debug (safe guard)
if (
  typeof import.meta !== "undefined" &&
  import.meta.env?.MODE === "development"
) {
  console.log(
    "🔹 Supabase initialized:",
    SUPABASE_URL.split(".")[0] + "..."
  );
}
