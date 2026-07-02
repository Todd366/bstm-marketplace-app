import { supabase } from "./supabase-client.js";

// ============================================
// BSTM AUTH CORE (CLEAN SINGLE LAYER)
// No duplicate session calls anywhere else
// ============================================

let cachedUser = null;
let cachedSession = null;

// ---------- INTERNAL SYNC ----------
async function refreshSession() {
  const { data } = await supabase.auth.getSession();
  cachedSession = data?.session || null;
  cachedUser = cachedSession?.user || null;
  return cachedSession;
}

// ---------- PUBLIC API ----------
export async function getUser() {
  if (!cachedUser) await refreshSession();
  return cachedUser;
}

export async function getSession() {
  if (!cachedSession) await refreshSession();
  return cachedSession;
}

export async function isLoggedIn() {
  const session = await getSession();
  return !!session;
}

export async function logout() {
  await supabase.auth.signOut();
  cachedUser = null;
  cachedSession = null;
  window.location.href = "login.html";
}

// ---------- GUARD ----------
export async function requireAuth(redirectTo = "login.html") {
  const session = await getSession();

  if (!session) {
    window.location.href = redirectTo;
    return null;
  }

  return session;
}

// ---------- OPTIONAL: LIVE SYNC HOOK ----------
supabase.auth.onAuthStateChange((event, session) => {
  cachedSession = session;
  cachedUser = session?.user || null;

  window.dispatchEvent(
    new CustomEvent("bstm:auth", {
      detail: { event, session }
    })
  );
});
