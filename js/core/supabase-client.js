// ============================================
// BSTM SUPABASE CLIENT (LOCAL + BROWSER SAFE)
// ============================================

import { createClient } from '@supabase/supabase-js';
import { loadConfig } from './config.js';

// Load config
const config = loadConfig();

const SUPABASE_URL = config.API.SUPABASE_URL;

const SUPABASE_ANON_KEY = config.API.SUPABASE_KEY;

// Create client (single instance)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Attach globally for legacy scripts (VERY IMPORTANT)
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}

// Debug safe
if (config.APP?.ENVIRONMENT === 'development') {
  console.log('[BSTM] Supabase ready:', SUPABASE_URL);
}
