import { supabase } from "./core/supabase-client.js";
import "./core/cart.js"; // registers window.addToCart globally
import "./multi-language.js"; // registers window.MultiLanguage globally
import "./form-validation.js"; // registers window.FormValidator globally
import "./toast-notifications.js"; // registers window.Toast globally

// ============================================
// BSTM APP CORE (SINGLE SOURCE OF TRUTH)
// ============================================

let currentSession = null;
let isBootstrapped = false;
let readyResolve;

const readyPromise = new Promise((resolve) => {
  readyResolve = resolve;
});

// ===============================
// NAV UI SYNC (SAFE DOM VERSION)
// ===============================
function updateNav(session) {
  const user = session?.user || null;

  const navLoginBtns = document.querySelectorAll("#nav-login-btn");
  const navUserNames = document.querySelectorAll("#nav-user-name");
  const navUserMenus = document.querySelectorAll("#nav-user-menu");

  navLoginBtns.forEach((el) => {
    if (!el) return;
    el.style.display = user ? "none" : "inline-block";
  });

  navUserMenus.forEach((el) => {
    if (!el) return;
    el.style.display = user ? "flex" : "none";
  });

  navUserNames.forEach((el) => {
    if (!el) return;

    if (user) {
      el.textContent = user.email ? user.email.split("@")[0] : "User";
      el.style.display = "inline-block";
    } else {
      el.style.display = "none";
    }
  });
}

// ===============================
// BOOTSTRAP SESSION
// ===============================
async function bootstrap() {
  if (isBootstrapped) return;
  isBootstrapped = true;

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.warn("[BSTM] Session error:", error.message);
    }

    currentSession = data?.session || null;

    // IMPORTANT: only update nav AFTER DOM is ready
    requestAnimationFrame(() => updateNav(currentSession));

    readyResolve(currentSession);

    window.dispatchEvent(
      new CustomEvent("bstm:ready", {
        detail: currentSession,
      })
    );

    // AUTH LISTENER (single source)
    supabase.auth.onAuthStateChange((event, session) => {
      currentSession = session;

      requestAnimationFrame(() => updateNav(session));

      if (event === "SIGNED_IN") {
        window.dispatchEvent(
          new CustomEvent("bstm:login", { detail: session })
        );
      }

      if (event === "SIGNED_OUT") {
        window.dispatchEvent(new CustomEvent("bstm:logout"));
      }
    });
  } catch (err) {
    console.error("[BSTM] Bootstrap failed:", err);
    readyResolve(null);
  }
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", bootstrap);

// ===============================
// HANDLE DYNAMIC NAV INJECTION
// ===============================
// bstm:ready (session check, usually fast/local) and bstm:componentLoaded
// (nav.html network fetch via smart-loader.js) are two independent async
// operations with no guaranteed order. On a slow connection the nav fetch
// can easily finish AFTER the session check, meaning the first updateNav()
// call finds no nav elements in the DOM yet (silently does nothing) and
// never gets retried. Listening for both makes sure at least one call
// happens after the nav actually exists.
window.addEventListener("bstm:ready", () => {
  requestAnimationFrame(() => updateNav(currentSession));
});
window.addEventListener("bstm:componentLoaded", () => {
  requestAnimationFrame(() => updateNav(currentSession));
});

// ===============================
// GLOBAL API
// ===============================
window.BSTM = {
  ready: () => readyPromise,
  getSession: () => currentSession,
  getUser: () => currentSession?.user || null,
  isLoggedIn: () => !!currentSession,

  logout: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[BSTM] Logout error:", e);
    }

    currentSession = null;
    window.location.href = "login.html";
  },
};

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(function(r) { console.log('SW registered'); })
      .catch(function(e) { console.warn('SW failed:', e); });
  });
}
