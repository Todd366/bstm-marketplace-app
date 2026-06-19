import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://tvtfxkavjqvurdezhyvu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_xlZ3YKF6h5XBMhARWkE9_g_PVudo5r8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
