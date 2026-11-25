// The emailed link lands here. Supabase delivers the session in the URL hash; app.js picks it up and fires bstm:login.
// This page then finishes what the person asked for at the workspace door (door.js intent): create the account they
// asked for, accept updated Terms, or just enter the workspace. Anything that needs a decision goes back to that
// workspace's door, which explains it.
import { supabase } from "../core/supabase-client.js";
import { fetchAccounts, resolveDoor, readIntent, clearIntent, registerWorkspace, acceptTerms, activate, readStore, WS_KEY } from "../core/door.js";
import { activeIds, doorUrl } from "../core/workspaces.js";

function show(state) {
  ["loading", "success", "error"].forEach(function (s) {
    var el = document.getElementById("state-" + s);
    if (el) el.style.display = s === state ? "block" : "none";
  });
}

function countdownTo(url) {
  var n = 3;
  var el = document.getElementById("countdown");
  var manualLink = document.getElementById("manual-continue-link");
  if (manualLink) manualLink.href = url;
  var iv = setInterval(function () {
    n--;
    if (el) el.textContent = n;
    if (n <= 0) {
      clearInterval(iv);
      window.location.href = url;
    }
  }, 1000);
}

let started = false;
async function complete(session) {
  if (started) return;
  started = true;
  const intent = readIntent() || { ws: null, mode: "login", redirect: "", accepted: false };
  const stored = readStore(localStorage, WS_KEY).ws;
  const decide = async (accepted) => {
    const { ok, rows } = await fetchAccounts(supabase, session.user.id);
    return { rows, next: resolveDoor({ rows: ok ? rows : null, ws: intent.ws, mode: intent.mode, accepted, redirect: intent.redirect, stored }) };
  };
  try {
    let { rows, next } = await decide(intent.accepted);
    if (next.kind === "register-now" || next.kind === "accept-now") {
      const res = next.kind === "register-now" ? await registerWorkspace(supabase, next.ws) : await acceptTerms(supabase, next.ws);
      if (!res.ok) throw new Error(res.error);
      ({ rows, next } = await decide(false));
    }
    var name = session.user.email.split("@")[0];
    var msg = document.getElementById("welcome-msg");
    if (msg) msg.textContent = "Welcome, " + name + "!";

    if (next.kind === "go") {
      activate(session.user.id, next.ws, activeIds(rows));
      clearIntent();
      show("success");
      return countdownTo(next.url);
    }
    if (next.kind === "legacy") {
      // accounts cannot be read: the pre-accounts rule decides where this person starts
      const dest = intent.redirect || (await window.BSTM.workspaceHome());
      clearIntent();
      show("success");
      return countdownTo(dest);
    }
    // needs a decision (create the account, accept updated Terms, staff account missing, suspended, nothing chosen yet)
    window.location.replace(next.kind === "choose" || !next.ws ? "welcome.html" : doorUrl(next.ws, { mode: next.kind === "create" ? "register" : "login", redirect: intent.redirect }));
  } catch (err) {
    console.error("[BSTM] Finishing sign-in failed:", err);
    started = false;
    show("error");
  }
}

// Start in loading state
show("loading");

// Case 1: a valid session already exists (e.g. came back to verify.html)
window.BSTM.ready().then(function (session) {
  if (session && session.user) return complete(session);

  // Case 2: magic link just clicked: tokens are in the hash; app.js fires bstm:login on SIGNED_IN.
  window.addEventListener("bstm:login", function (e) {
    if (e.detail && e.detail.user) complete(e.detail);
  });

  // Case 3: nothing happened in 8s
  setTimeout(function () {
    var loading = document.getElementById("state-loading");
    if (loading && loading.style.display !== "none") show("error");
  }, 8000);
});
