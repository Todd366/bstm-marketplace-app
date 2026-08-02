import { supabase } from "./core/supabase-client.js";

// ============================================
// BSTM SINGLE SOURCE OF AUTH TRUTH
// All pages read session state through window.BSTM
// Nobody else calls supabase.auth.getSession() or
// supabase.auth.onAuthStateChange() directly.
// ============================================

let currentSession = null;
let readyResolve;
const readyPromise = new Promise((resolve) => { readyResolve = resolve; });

function updateNav(session) {
  const navLogin = document.getElementById("nav-login-btn");
  const navUser = document.getElementById("nav-user-name");
  if (session && session.user) {
    if (navLogin) navLogin.style.display = "none";
    if (navUser) {
      navUser.textContent = session.user.email.split("@")[0];
      navUser.style.display = "block";
    }
  } else {
    if (navLogin) navLogin.style.display = "block";
    if (navUser) navUser.style.display = "none";
  }
}

async function bootstrap() {
  const { data: { session } } = await supabase.auth.getSession();
  currentSession = session;
  updateNav(session);
  readyResolve(session);
  window.dispatchEvent(new CustomEvent("bstm:ready", { detail: session }));

  // ONE listener for the whole app. Every auth change flows through here.
  supabase.auth.onAuthStateChange((event, session) => {
    currentSession = session;
    updateNav(session);
    if (event === "SIGNED_IN") {
      window.dispatchEvent(new CustomEvent("bstm:login", { detail: session }));
    }
    if (event === "SIGNED_OUT") {
      window.dispatchEvent(new CustomEvent("bstm:logout"));
    }
  });
}

document.addEventListener("DOMContentLoaded", bootstrap);

// ============================================
// PUBLIC API — page modules use this, never
// supabase.auth.* directly.
// ============================================
window.BSTM = {
  // Resolves once, with whatever session existed at page load.
  // Page modules await this instead of calling getSession().
  ready: () => readyPromise,

  // Synchronous read after ready has resolved.
  getSession: () => currentSession,

  getUser: () => currentSession?.user || null,

  logout: async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  }
};
