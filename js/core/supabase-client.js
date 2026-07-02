import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Load from environment variables or use fallbacks
// In production: Set via hosting platform (Vercel, GitHub Pages, etc.)
const SUPABASE_URL = 
  import.meta.env?.VITE_SUPABASE_URL ||
  window.BSTM_CONFIG?.SUPABASE_URL ||
  "https://tvtfxkavjqvurdezhyvu.supabase.co";

const SUPABASE_ANON_KEY = 
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  window.BSTM_CONFIG?.SUPABASE_ANON_KEY ||
  "sb_publishable_xlZ3YKF6h5XBMhARWkE9_g_PVudo5r8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Debug mode (remove in production)
if (import.meta.env?.MODE === "development") {
  console.log("🔹 Supabase initialized with URL:", SUPABASE_URL.split(".")[0] + "....");
}
