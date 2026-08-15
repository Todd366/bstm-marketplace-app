// ============================================
// BSTM SUPABASE CLIENT (LOCAL + BROWSER SAFE)
// ============================================

// IMPORTANT: this MUST be a full URL, not a bare package name.
// This is a plain static site with no bundler (no Vite/Webpack), deployed
// as-is to GitHub Pages. Browsers cannot resolve bare specifiers like
// '@supabase/supabase-js' in native <script type="module"> — that only
// works when a bundler rewrites the import at build time. A bare specifier
// here throws "Failed to resolve module specifier" and silently kills
// EVERY page's JS, since app.js (and therefore login/cart/checkout/etc.)
// imports from this file. Pinned to match package.json's ^2.110.0.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0';
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
