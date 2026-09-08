import { supabase } from "./core/supabase-client.js";
import { getProfile } from "./bstm-core.js";
import "./core/cart.js"; // registers window.addToCart globally
import "./multi-language.js"; // registers window.MultiLanguage globally
import "./form-validation.js"; // registers window.FormValidator globally
import "./toast-notifications.js"; // registers window.Toast globally
import "./core/nav-notifications.js"; // wires the real notification bell in nav.html

// ============================================
// BSTM APP CORE (SINGLE SOURCE OF TRUTH)
// ============================================

let currentSession = null;
let currentRole = null; // resolved once per session, used for nav filtering
let isBootstrapped = false;
let readyResolve;

const readyPromise = new Promise((resolve) => {
  readyResolve = resolve;
});

// ===============================
// ROLE-BASED NAV VISIBILITY
// ===============================
// Every nav link declares data-roles="public" / "auth" / "buyer" /
// "seller" / "admin" (comma-separated for more than one). A logged-out
// visitor sees only "public". A logged-in user sees "public" + "auth"
// + whichever of their own roles match — so a buyer never sees Admin,
// Seller, Analytics, etc, without a single new page being created.
function filterNavByRole() {
  const links = document.querySelectorAll("[data-roles]");
  links.forEach((el) => {
    const allowed = el.dataset.roles.split(",").map((r) => r.trim());
    let visible = allowed.includes("public");
    if (currentSession) {
      if (allowed.includes("auth")) visible = true;
      if (currentRole && allowed.includes(currentRole)) visible = true;
    }
    el.style.display = visible ? "" : "none";
  });
}

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

  filterNavByRole();
}

// ===============================
// ROLE RESOLUTION
// ===============================
async function resolveRole(userId) {
  const { data: profile, error } = await getProfile(userId);
  if (error || !profile) return null;
  return profile.role || null;
}

// Nav is injected asynchronously by smart-loader.js and may finish
// before or after session bootstrap — re-apply filtering whichever
// happens second, so a role is never left unapplied by a race.
window.addEventListener("bstm:componentLoaded", filterNavByRole);

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
    currentRole = currentSession ? await resolveRole(currentSession.user.id) : null;

    // IMPORTANT: only update nav AFTER DOM is ready
    requestAnimationFrame(() => updateNav(currentSession));

    readyResolve(currentSession);

    window.dispatchEvent(
      new CustomEvent("bstm:ready", {
        detail: currentSession,
      })
    );

    // AUTH LISTENER (single source)
    supabase.auth.onAuthStateChange(async (event, session) => {
      currentSession = session;
      currentRole = session ? await resolveRole(session.user.id) : null;

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
// nav.html is fetched and injected asynchronously by smart-loader.js, with
// no guaranteed ordering against the session check above. Event-based
// retries (bstm:ready / bstm:componentLoaded) were tried here before and
// still proved unreliable in practice — chasing exact timing across three
// independent async systems (fetch, DOMContentLoaded, requestAnimationFrame)
// is fragile by nature. A MutationObserver sidesteps the whole problem: it
// fires the instant nav.html's markup actually lands in the DOM, no matter
// what order anything else happens in, and needs no retry logic at all.
const navContainer = document.getElementById("bstm-nav");
if (navContainer) {
  const navObserver = new MutationObserver(() => {
    updateNav(currentSession);
  });
  navObserver.observe(navContainer, { childList: true });
}
// Also covers the case where nav.html was already injected before this
// script ran (e.g. cached/instant fetch on a fast connection).
requestAnimationFrame(() => updateNav(currentSession));

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
