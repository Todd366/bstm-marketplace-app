// A workspace's own door: sign in, or create an account in THIS workspace.
//   login.html?workspace=buyer|seller|agent|admin|government [&mode=register] [&redirect=page.html]
// Signing in proves who you are (your email). It does not give you a workspace: each workspace has its own account,
// and this page either lets you in, lets you create the account (Buyer, Seller) or says plainly that BSTM creates it
// (Agent, Admin, Government). See js/core/door.js.
import { supabase } from "../core/supabase-client.js";
import { WORKSPACES, DOORS, SELF_REGISTER, TERMS_VERSION, workspaceForPage } from "../core/workspaces.js";
import { safeRedirect, storeIntent, clearIntent, fetchAccounts, resolveDoor, registerWorkspace, acceptTerms, activate, readStore, WS_KEY } from "../core/door.js";
import { activeIds } from "../core/workspaces.js";

// Dynamic instead of hardcoded: works on GitHub Pages (subdirectory), Vercel or a custom domain.
// IMPORTANT: this URL must stay EXACTLY as-is with no query params (Supabase's redirect allowlist may require an exact
// match). What the person asked for here is kept in this browser instead (door.js storeIntent) and read by verify.js.
const VERIFY_URL = window.location.origin + window.location.pathname.replace(/login\.html$/, "verify.html");

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const redirect = safeRedirect(params.get("redirect"));

// which workspace's door is this? The one named, else the one the page being asked for belongs to.
let ws = params.get("workspace");
if (!WORKSPACES[ws]) ws = redirect ? workspaceForPage(redirect.split(/[?#]/)[0].toLowerCase()) : null;

function showStatus(msg, type) {
  const el = $("status");
  el.textContent = msg;
  el.style.display = "block";
  el.style.background = type === "success" ? "#DCFCE7" : "#FEE2E2";
  el.style.color = type === "success" ? "#166534" : "#991B1B";
  el.style.border = "1px solid " + (type === "success" ? "#BBF7D0" : "#FECACA");
}
const hideStatus = () => ($("status").style.display = "none");

function friendlyError(message) {
  if (!message) return "Something went wrong. Please try again.";
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many")) return "Too many requests. Please wait a few minutes before trying again.";
  if (m.includes("invalid email") || m.includes("unable to validate")) return "Please enter a valid email address.";
  if (m.includes("network") || m.includes("fetch")) return "Network error. Check your connection and try again.";
  return "Failed to send the link: " + message;
}

function show(which) {
  ["login-form", "panel-sent", "panel-action"].forEach((id) => ($(id).style.display = id === which ? "block" : "none"));
}

const label = ws ? WORKSPACES[ws].label : "";
let mode = params.get("mode") === "register" && SELF_REGISTER.includes(ws) ? "register" : "login";

// ---------------------------------------------------------------- header + tabs
function paintHead() {
  const w = WORKSPACES[ws];
  $("door-icon").textContent = w.icon;
  $("door-name").textContent = w.label + " workspace";
  $("door-tagline").textContent = w.tagline;
  document.title = (mode === "register" ? "Create " + w.label + " account" : w.label + " sign-in") + " - BSTM Digital Mall";
  const canRegister = SELF_REGISTER.includes(ws);
  $("tabs").style.display = canRegister ? "flex" : "none";
  for (const [id, m] of [["tab-login", "login"], ["tab-register", "register"]]) {
    const on = mode === m;
    $(id).setAttribute("aria-selected", on ? "true" : "false");
    $(id).style.background = on ? "#fff" : "transparent";
    $(id).style.color = on ? "#00708E" : "#4B5563";
    $(id).style.boxShadow = on ? "0 1px 4px rgba(0,0,0,0.12)" : "none";
  }
}

function paintForm() {
  paintHead();
  const reg = mode === "register";
  $("door-title").textContent = reg ? "Create your " + label + " account" : label + " sign-in";
  $("door-sub").textContent = reg
    ? "Enter your email. We send a link that confirms it and creates your " + label + " account."
    : SELF_REGISTER.includes(ws)
      ? "Enter your email to receive a sign-in link for your " + label + " account."
      : DOORS[ws].blurb + " Accounts here are created by BSTM.";
  $("terms-row").style.display = reg ? "flex" : "none";
  $("terms-check").checked = false;
  $("submit-btn").textContent = reg ? "Create " + label + " account" : "Send sign-in link";
  $("door-note").style.display = "block";
  hideStatus();
  show("login-form");
}

function setMode(m) {
  mode = m;
  const q = new URLSearchParams(window.location.search);
  q.set("workspace", ws);
  if (m === "register") q.set("mode", "register");
  else q.delete("mode");
  window.history.replaceState(null, "", "login.html?" + q.toString());
  paintForm();
}

// ---------------------------------------------------------------- panels for someone who is already signed in
function panel({ title, text, button, terms, onClick, tone }) {
  paintHead();
  $("tabs").style.display = "none";
  $("door-title").textContent = title;
  $("door-sub").textContent = text;
  $("door-note").style.display = "none";
  hideStatus();
  $("act-terms-row").style.display = terms ? "flex" : "none";
  $("act-terms-check").checked = false;
  const btn = $("act-btn");
  btn.style.display = button ? "block" : "none";
  if (button) {
    btn.textContent = button;
    btn.disabled = !!terms;
    btn.style.opacity = terms ? "0.5" : "1";
    btn.onclick = onClick;
  }
  $("act-terms-check").onchange = () => {
    btn.disabled = !$("act-terms-check").checked;
    btn.style.opacity = btn.disabled ? "0.5" : "1";
  };
  show("panel-action");
}

async function enter(session, rows, target) {
  const ids = activeIds(rows);
  activate(session.user.id, target.ws, ids);
  clearIntent();
  window.location.replace(target.url);
}

async function signedIn(session) {
  const email = session.user.email || "your account";
  $("signout-wrap").style.display = "inline";
  $("signout-link").onclick = () => window.BSTM.logout();
  const stored = readStore(localStorage, WS_KEY).ws;

  async function step(accepted) {
    const { ok, rows } = await fetchAccounts(supabase, session.user.id);
    const next = resolveDoor({ rows: ok ? rows : null, ws, mode, accepted, redirect, stored });
    switch (next.kind) {
      case "legacy":
        // the accounts table cannot be read: the pre-accounts rule decides where this person starts
        return window.location.replace(await window.BSTM.workspaceHome());
      case "choose":
        return window.location.replace("welcome.html");
      case "go":
        return enter(session, rows, next);
      case "register-now":
      case "accept-now": {
        const res = next.kind === "register-now" ? await registerWorkspace(supabase, ws) : await acceptTerms(supabase, ws);
        if (!res.ok) return fail(res.error);
        return step(false);
      }
      case "create":
        return panel({
          title: "Create your " + label + " account",
          text: "You are signed in as " + email + ", which has no " + label + " account yet. Each workspace has its own account, so this one is created separately from your others.",
          button: "Create " + label + " account",
          terms: true,
          onClick: async () => {
            $("act-btn").disabled = true;
            const res = await registerWorkspace(supabase, ws);
            if (!res.ok) return fail(res.error);
            step(false);
          },
        });
      case "terms":
        return panel({
          title: next.first ? "Accept the Terms" : "Updated Terms",
          text: next.first
            ? "BSTM now records your acceptance of the Terms and Privacy Policy for each workspace account. Please read and accept them (version " + TERMS_VERSION + ") to continue to your " + label + " workspace."
            : "The Terms and Privacy Policy changed (version " + TERMS_VERSION + "). Please read and accept them to continue to your " + label + " workspace.",
          button: "Accept and continue",
          terms: true,
          onClick: async () => {
            $("act-btn").disabled = true;
            const res = await acceptTerms(supabase, ws);
            if (!res.ok) return fail(res.error);
            step(false);
          },
        });
      case "staff-missing":
        return panel({ title: "No " + label + " account", text: email + " has no " + label + " account. " + label + " accounts are created by BSTM and cannot be created here. If you should have one, contact BSTM." });
      case "suspended":
        return panel({ title: label + " account suspended", text: "The " + label + " account for " + email + " is suspended. Contact BSTM to have it looked at." });
      default:
        return fail("Unexpected state");
    }
  }
  function fail(error) {
    showStatus("That did not work: " + (error || "please try again") + ".", "error");
    const btn = $("act-btn");
    if (btn) btn.disabled = false;
  }
  // a person who just clicked "Create account" and ticked the box before the link was sent: the intent says so
  await step(false);
}

// ---------------------------------------------------------------- not signed in: ask for the emailed link
function wireForm() {
  $("tab-login").onclick = () => setMode("login");
  $("tab-register").onclick = () => setMode("register");
  $("sent-again").onclick = () => paintForm();
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("submit-btn");
    const email = $("email-input").value.trim().toLowerCase();
    if (!email || !email.includes("@")) return showStatus("Please enter a valid email address.", "error");
    if (mode === "register" && !$("terms-check").checked) return showStatus("Please accept the Terms and Privacy Policy to create an account.", "error");

    btn.disabled = true;
    btn.textContent = "Sending...";
    storeIntent({ ws, mode, redirect, accepted: mode === "register" && $("terms-check").checked });
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: VERIFY_URL } });
    if (error) {
      clearIntent();
      showStatus(friendlyError(error.message), "error");
      btn.disabled = false;
      btn.textContent = mode === "register" ? "Create " + label + " account" : "Send sign-in link";
      return;
    }
    hideStatus();
    $("door-title").textContent = "Check your email";
    $("door-sub").textContent = "";
    $("sent-text").textContent = "We sent a link to " + email + ". Open it on this device to " + (mode === "register" ? "create your " + label + " account." : "sign in to your " + label + " workspace.");
    show("panel-sent");
    btn.disabled = false;
  });
}

// ---------------------------------------------------------------- start
if (!ws) {
  // no workspace named and none implied: choose one first
  window.location.replace("welcome.html" + (redirect ? "?redirect=" + encodeURIComponent(redirect) : ""));
} else {
  paintHead();
  wireForm();
  window.BSTM.ready().then(async (session) => {
    if (!session) return paintForm();
    // already signed in: no form, check which accounts this email holds
    $("door-title").textContent = label + " sign-in";
    $("door-sub").textContent = "Checking your accounts...";
    $("tabs").style.display = "none";
    $("door-note").style.display = "none";
    $("act-btn").style.display = "none";
    $("act-terms-row").style.display = "none";
    show("panel-action");
    await signedIn(session);
  });
}
