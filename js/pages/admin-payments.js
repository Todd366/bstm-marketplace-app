// js/pages/admin-payments.js
// Admin control room for payments: confirm / reject manual payments, resolve payments held for
// review, and switch payment methods on or off. Every change is made by a database function that
// re-checks the caller is an admin and writes the audit log; this page only asks.
import { requireRole } from "../bstm-core.js?v=1792108428";
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";
import { money, shortGroupRef, paymentErrorMessage, dbErrorCode, getGatewayHealth } from "../core/payments.js";

const esc = escapeHtml;
const $ = (id) => document.getElementById(id);

const S = { queue: [], providers: [], health: null, healthFailed: false, open: new Set(), flashTimer: null };

// ------------------------------------------------------------------ helpers
function ago(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60);
  if (h < 48) return h + " h ago";
  return Math.floor(h / 24) + " days ago";
}

function when(iso) {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) ? new Date(t).toLocaleString("en-BW", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function flash(kind, text) {
  const el = $("ap-flash");
  el.className = "ap-banner " + kind;
  el.textContent = text;
  clearTimeout(S.flashTimer);
  S.flashTimer = setTimeout(() => el.classList.add("ap-hidden"), 9000);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function rpcMessage(error) {
  const code = dbErrorCode(error);
  return code ? paymentErrorMessage(code) : "Something went wrong. Please try again.";
}

// ------------------------------------------------------------------ confirm dialog
function openDialog({ title, bodyHtml, confirmLabel, confirmClass, checkText, noteLabel, noteRequired, onConfirm }) {
  const root = $("ap-modal-root");
  root.innerHTML =
    '<div class="ap-modal" id="ap-modal"><div class="ap-modal-box" role="dialog" aria-modal="true">' +
    `<h3>${esc(title)}</h3>` +
    `<div class="ap-meta" style="margin-bottom:6px;">${bodyHtml}</div>` +
    (checkText ? `<label class="ap-check"><input type="checkbox" id="ap-dlg-check"><span>${esc(checkText)}</span></label>` : "") +
    (noteLabel
      ? `<label class="ap-label" for="ap-dlg-note">${esc(noteLabel)}</label><textarea class="ap-text" id="ap-dlg-note" maxlength="300"></textarea>`
      : "") +
    '<p class="ap-err ap-hidden" id="ap-dlg-err"></p>' +
    '<div class="ap-actions" style="justify-content:flex-end;">' +
    '<button class="ap-btn alt" type="button" id="ap-dlg-cancel">Cancel</button>' +
    `<button class="ap-btn ${esc(confirmClass || "")}" type="button" id="ap-dlg-ok">${esc(confirmLabel)}</button>` +
    "</div></div></div>";

  const ok = $("ap-dlg-ok");
  const check = $("ap-dlg-check");
  const note = $("ap-dlg-note");
  const err = $("ap-dlg-err");
  const close = () => {
    root.innerHTML = "";
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);

  const refreshOk = () => {
    let allowed = true;
    if (check && !check.checked) allowed = false;
    if (noteRequired && note && note.value.trim().length < 3) allowed = false;
    ok.disabled = !allowed;
  };
  refreshOk();
  if (check) check.addEventListener("change", refreshOk);
  if (note) note.addEventListener("input", refreshOk);
  $("ap-dlg-cancel").addEventListener("click", close);
  $("ap-modal").addEventListener("click", (e) => {
    if (e.target.id === "ap-modal") close();
  });
  ok.addEventListener("click", async () => {
    ok.disabled = true;
    $("ap-dlg-cancel").disabled = true;
    err.classList.add("ap-hidden");
    const res = await onConfirm(note ? note.value.trim() : "");
    if (res && res.ok) {
      close();
      return;
    }
    err.textContent = (res && res.error) || "Something went wrong. Please try again.";
    err.classList.remove("ap-hidden");
    $("ap-dlg-cancel").disabled = false;
    refreshOk();
  });
}

// ------------------------------------------------------------------ data
async function loadQueue() {
  const { data, error } = await supabase.rpc("admin_list_payment_queue");
  if (error) {
    console.warn("[BSTM Payments Admin] queue load failed:", error);
    return false;
  }
  S.queue = Array.isArray(data) ? data : [];
  return true;
}

async function loadProviders() {
  const { data, error } = await supabase.rpc("admin_list_payment_providers");
  if (error) {
    console.warn("[BSTM Payments Admin] provider load failed:", error);
    return false;
  }
  S.providers = Array.isArray(data) ? data : [];
  return true;
}

async function loadHealth() {
  const h = await getGatewayHealth();
  if (h.ok) {
    S.health = new Map(h.providers.map((p) => [p.slug, p]));
    S.healthFailed = false;
  } else {
    S.health = null;
    S.healthFailed = true;
  }
}

// ------------------------------------------------------------------ queue view
const QUEUE_STATE = {
  pending: ["wait", "Waiting for buyer"],
  awaiting_confirmation: ["warn", "Reference received — check it"],
  review: ["review", "Held for review"],
};

function queueCard(g) {
  const [pillKind, pillText] = QUEUE_STATE[g.status] || ["off", g.status];
  const isReview = g.status === "review";
  const canConfirm = g.kind === "manual" && (g.status === "awaiting_confirmation" || g.status === "pending");
  const buyer = [g.buyer_email, g.buyer_phone].filter(Boolean).join(" · ") || "Unknown buyer";
  const n = Number(g.order_count || 0);
  return (
    `<div class="ap-card ${isReview ? "review" : ""}" data-group="${esc(g.id)}">` +
    '<div class="ap-row"><div>' +
    `<div class="ap-title">${esc(g.provider_name || g.provider)} <span class="ap-pill ${pillKind}">${esc(pillText)}</span></div>` +
    `<div class="ap-meta">${esc(buyer)}</div>` +
    `<div class="ap-meta">${esc(shortGroupRef(g.id))} · ${n} order${n === 1 ? "" : "s"} · started ${esc(ago(g.created_at))}${g.expires_at ? " · window ends " + esc(when(g.expires_at)) : ""}</div>` +
    (g.payer_reference ? `<div class="ap-meta">Buyer's reference: <b>${esc(g.payer_reference)}</b></div>` : g.kind === "manual" ? '<div class="ap-meta">No reference sent yet.</div>' : "") +
    (isReview && g.failure_reason ? `<div class="ap-meta" style="color:#9a3412;">Why: ${esc(g.failure_reason)}</div>` : "") +
    `</div><div class="ap-amount">${esc(money(g.amount))}</div></div>` +
    '<div class="ap-actions">' +
    (canConfirm
      ? `<button class="ap-btn ok" data-act="approve" data-id="${esc(g.id)}">Confirm payment received</button>` +
        `<button class="ap-btn bad" data-act="reject" data-id="${esc(g.id)}">Reject</button>`
      : "") +
    (isReview ? `<button class="ap-btn alt" data-act="refund" data-id="${esc(g.id)}">Mark as refunded</button>` : "") +
    "</div></div>"
  );
}

function renderQueue() {
  const el = $("ap-queue");
  if (S.queue.length === 0) {
    el.innerHTML = '<div class="ap-empty">Nothing is waiting. New manual payments and reviews appear here.</div>';
    return;
  }
  const order = { review: 0, awaiting_confirmation: 1, pending: 2 };
  const rows = [...S.queue].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || Date.parse(a.created_at) - Date.parse(b.created_at));
  el.innerHTML = rows.map(queueCard).join("");
}

function findGroup(id) {
  return S.queue.find((g) => g.id === id);
}

function decideManual(g, approve) {
  const who = [g.buyer_email, g.buyer_phone].filter(Boolean).join(" · ") || "the buyer";
  const body =
    `<b>${esc(money(g.amount))}</b> via ${esc(g.provider_name || g.provider)} from ${esc(who)}.` +
    (g.payer_reference ? `<br>Reference: <b>${esc(g.payer_reference)}</b>` : "<br>The buyer has not sent a reference.");
  if (approve) {
    openDialog({
      title: "Confirm this payment?",
      bodyHtml: body + "<br>Their order(s) will be confirmed and the seller told to prepare them.",
      confirmLabel: "Confirm payment",
      confirmClass: "ok",
      checkText: `I have seen ${money(g.amount)} arrive in the ${g.provider_name || g.provider} account for this payment.`,
      noteLabel: "Note (optional)",
      onConfirm: (note) => submitDecision(g, true, note),
    });
  } else {
    openDialog({
      title: "Reject this payment?",
      bodyHtml: body + "<br>The buyer is told it wasn't completed and can try again while the order is still reserved.",
      confirmLabel: "Reject payment",
      confirmClass: "bad",
      noteLabel: "Reason (shown in the audit log)",
      noteRequired: true,
      onConfirm: (note) => submitDecision(g, false, note),
    });
  }
}

async function submitDecision(g, approve, note) {
  const { data, error } = await supabase.rpc("payments_staff_confirm_manual", {
    p_group: g.id,
    p_approve: approve,
    p_note: note || null,
  });
  if (error) return { ok: false, error: rpcMessage(error) };
  if (data && data.applied === false) {
    const why = data.reason === "review_required" ? "it was moved to review (an order was cancelled or already paid)" : data.reason || "nothing changed";
    flash("info", `Not applied: ${why}.`);
  } else {
    flash("ok", approve ? "Payment confirmed. The order is now confirmed." : "Payment rejected. The buyer has been notified.");
  }
  await loadQueue();
  renderQueue();
  return { ok: true };
}

function resolveReview(g) {
  openDialog({
    title: "Mark this payment as refunded?",
    bodyHtml:
      `<b>${esc(money(g.amount))}</b> via ${esc(g.provider_name || g.provider)}.<br>` +
      (g.failure_reason ? `Held because: ${esc(g.failure_reason)}<br>` : "") +
      "Only do this <b>after</b> the money has been returned to the buyer (or you have confirmed none was taken). Cancelled orders become Refunded; open orders go back to unpaid-failed so the buyer can pay again.",
    confirmLabel: "Mark as refunded",
    confirmClass: "bad",
    checkText: "The money has been returned, or I confirmed none was taken.",
    noteLabel: "What you did (shown in the audit log)",
    noteRequired: true,
    onConfirm: async (note) => {
      const { error } = await supabase.rpc("admin_resolve_payment_review", {
        p_group: g.id,
        p_resolution: "refunded",
        p_note: note,
      });
      if (error) return { ok: false, error: rpcMessage(error) };
      flash("ok", "Marked as refunded.");
      await loadQueue();
      renderQueue();
      return { ok: true };
    },
  });
}

// ------------------------------------------------------------------ providers view
function statusLabel(s) {
  return s === "live" ? "Live" : s === "sandbox" ? "Sandbox (test)" : "Not set up";
}

function healthLine(p) {
  if (p.kind !== "gateway") return "";
  if (S.healthFailed) return '<div class="ap-meta">Couldn\'t check this gateway\'s secrets just now.</div>';
  const h = S.health && S.health.get(p.slug);
  if (!h) return '<div class="ap-meta"><span class="ap-pill bad">No adapter</span> This gateway has no connector in the payments service yet, so it can\'t take payments.</div>';
  return h.configured
    ? '<div class="ap-meta"><span class="ap-pill on">Secrets set</span> All server-side secrets for this gateway are present.</div>'
    : `<div class="ap-meta"><span class="ap-pill warn">Secrets missing</span> Add these in Supabase → Edge Functions → Secrets: <b>${esc((h.missing || []).join(", "))}</b></div>`;
}

function field(id, label, value, opts = {}) {
  const tag = opts.area
    ? `<textarea class="ap-text" id="${id}" maxlength="${opts.max || 600}">${esc(value || "")}</textarea>`
    : `<input class="ap-input" id="${id}" type="${opts.type || "text"}" ${opts.attrs || ""} maxlength="${opts.max || 120}" value="${esc(value ?? "")}">`;
  return `<div><label class="ap-label" for="${id}">${esc(label)}</label>${tag}${opts.help ? `<div class="ap-meta" style="font-size:12px;">${esc(opts.help)}</div>` : ""}</div>`;
}

function providerCard(p) {
  const cfg = p.config || {};
  const open = S.open.has(p.slug);
  const id = (k) => `ap-${p.slug}-${k}`;
  let cfgFields = "";
  if (p.kind === "manual") {
    cfgFields =
      field(id("instructions"), "Payment instructions buyers see (required to switch on)", cfg.instructions, { area: true, max: 800, help: "Say exactly how to pay: the number or account, what to write as the reference, and that they then send their payment reference here." }) +
      '<div class="ap-grid">' +
      field(id("account_label"), "Account label", cfg.account_label, { help: 'e.g. "MyZaka number"' }) +
      field(id("account"), "Account / wallet number", cfg.account) +
      ("bank" in cfg ? field(id("bank"), "Bank", cfg.bank) : "") +
      ("branch_code" in cfg ? field(id("branch_code"), "Branch code", cfg.branch_code) : "") +
      field(id("ussd"), "USSD code (optional)", cfg.ussd) +
      "</div>";
  }
  return (
    `<div class="ap-card" data-provider="${esc(p.slug)}">` +
    '<div class="ap-row"><div>' +
    `<div class="ap-title">${esc(p.display_name)} <span class="ap-pill ${p.enabled ? "on" : "off"}">${p.enabled ? "On" : "Off"}</span> ` +
    `<span class="ap-pill ${esc(p.status)}">${esc(statusLabel(p.status))}</span> <span class="ap-pill">${p.kind === "gateway" ? "Gateway" : "Manual"}</span></div>` +
    `<div class="ap-meta">${esc(p.description || "")}</div>` +
    `<div class="ap-meta">Code: ${esc(p.slug)} · buyers have ${Math.round(p.hold_minutes / 60 * 10) / 10} h to pay</div>` +
    healthLine(p) +
    "</div><div>" +
    `<button class="ap-btn ${p.enabled ? "bad" : "ok"}" data-act="toggle" data-slug="${esc(p.slug)}">${p.enabled ? "Switch off" : "Switch on"}</button>` +
    "</div></div>" +
    `<div class="ap-actions"><button class="ap-btn alt" data-act="edit" data-slug="${esc(p.slug)}">${open ? "Hide settings" : "Edit settings"}</button></div>` +
    (open
      ? '<div class="ap-prov-body">' +
        '<div class="ap-grid">' +
        field(id("display_name"), "Name buyers see", p.display_name, { max: 60 }) +
        `<div><label class="ap-label" for="${id("status")}">Mode</label><select class="ap-select" id="${id("status")}">` +
        ["not_onboarded", "sandbox", "live"].map((s) => `<option value="${s}" ${p.status === s ? "selected" : ""}>${esc(statusLabel(s))}</option>`).join("") +
        '</select><div class="ap-meta" style="font-size:12px;">Sandbox uses the provider\'s test mode. Live takes real money.</div></div>' +
        field(id("hold_minutes"), "Minutes buyers have to pay", p.hold_minutes, { type: "number", attrs: 'min="15" max="10080" step="1"', help: "15 to 10080. After this the order is cancelled and the items released." }) +
        field(id("sort_order"), "Position in the list (low = first)", p.sort_order, { type: "number", attrs: 'step="1"' }) +
        "</div>" +
        cfgFields +
        `<p class="ap-err ap-hidden" id="${id("err")}"></p>` +
        `<div class="ap-actions"><button class="ap-btn" data-act="save" data-slug="${esc(p.slug)}">Save settings</button></div>` +
        "</div>"
      : "") +
    "</div>"
  );
}

function renderProviders() {
  const el = $("ap-providers");
  if (S.providers.length === 0) {
    el.innerHTML = '<div class="ap-empty">No payment methods found.</div>';
  } else {
    el.innerHTML = S.providers.map(providerCard).join("");
  }
  const banner = $("ap-health");
  const bad = S.health ? [...S.health.values()].filter((h) => !h.configured) : [];
  if (S.healthFailed) {
    banner.textContent = "Couldn't check which gateway secrets are set. Switching a gateway on is still checked by the server before buyers can use it.";
    banner.classList.remove("ap-hidden");
  } else if (bad.length > 0) {
    banner.textContent = "Gateways with missing secrets can't be switched on yet: " + bad.map((h) => h.slug).join(", ") + ".";
    banner.classList.remove("ap-hidden");
  } else {
    banner.classList.add("ap-hidden");
  }
}

function findProvider(slug) {
  return S.providers.find((p) => p.slug === slug);
}

function toggleProvider(p) {
  if (!p.enabled) {
    // Switching on: refuse early with a clear reason (the database re-checks all of this).
    const cfg = p.config || {};
    if (p.kind === "manual" && !String(cfg.instructions || "").trim()) {
      flash("bad", paymentErrorMessage("instructions_required"));
      S.open.add(p.slug);
      renderProviders();
      return;
    }
    if (p.kind === "gateway" && p.status === "not_onboarded") {
      flash("bad", paymentErrorMessage("not_onboarded"));
      S.open.add(p.slug);
      renderProviders();
      return;
    }
    if (p.kind === "gateway" && S.health) {
      const h = S.health.get(p.slug);
      if (!h || !h.configured) {
        flash("bad", `${p.display_name} can't be switched on yet: ${h ? "missing secrets " + (h.missing || []).join(", ") : "the payments service has no connector for it"}.`);
        return;
      }
    }
    openDialog({
      title: `Switch on ${p.display_name}?`,
      bodyHtml:
        "Buyers will see it at checkout straight away." +
        (p.status === "live" ? "<br><b>This is Live: real money will move.</b>" : p.status === "sandbox" ? "<br>It is in Sandbox (test) mode." : ""),
      confirmLabel: "Switch on",
      confirmClass: "ok",
      onConfirm: () => setEnabled(p, true),
    });
  } else {
    openDialog({
      title: `Switch off ${p.display_name}?`,
      bodyHtml: "Buyers will no longer be able to choose it. Payments already started with it are not affected and can still be completed or confirmed.",
      confirmLabel: "Switch off",
      confirmClass: "bad",
      onConfirm: () => setEnabled(p, false),
    });
  }
}

async function setEnabled(p, enabled) {
  const { error } = await supabase.rpc("admin_set_payment_provider", { p_slug: p.slug, p_enabled: enabled });
  if (error) return { ok: false, error: rpcMessage(error) };
  flash("ok", `${p.display_name} is now ${enabled ? "on" : "off"}.`);
  await loadProviders();
  renderProviders();
  return { ok: true };
}

async function saveProvider(p, btn) {
  const id = (k) => `ap-${p.slug}-${k}`;
  const val = (k) => {
    const el = document.getElementById(id(k));
    return el ? el.value : null;
  };
  const err = document.getElementById(id("err"));
  const fail = (t) => {
    err.textContent = t;
    err.classList.remove("ap-hidden");
  };
  err.classList.add("ap-hidden");

  const name = (val("display_name") || "").trim();
  const hold = Number(val("hold_minutes"));
  const sort = Number(val("sort_order"));
  if (name.length < 2) return fail("Enter a name buyers will see.");
  if (!Number.isInteger(hold) || hold < 15 || hold > 10080) return fail("Hold time must be a whole number between 15 and 10080 minutes.");
  if (!Number.isInteger(sort)) return fail("Position must be a whole number.");

  const args = { p_slug: p.slug, p_status: val("status"), p_hold_minutes: hold, p_display_name: name, p_sort: sort };
  if (p.kind === "manual") {
    const cfg = {
      instructions: (val("instructions") || "").trim(),
      account_label: (val("account_label") || "").trim(),
      account: (val("account") || "").trim(),
      ussd: (val("ussd") || "").trim(),
    };
    if (document.getElementById(id("bank"))) cfg.bank = (val("bank") || "").trim();
    if (document.getElementById(id("branch_code"))) cfg.branch_code = (val("branch_code") || "").trim();
    args.p_config = cfg;
  }
  btn.disabled = true;
  const { error } = await supabase.rpc("admin_set_payment_provider", args);
  btn.disabled = false;
  if (error) return fail(rpcMessage(error));
  flash("ok", `${name} saved.`);
  S.open.delete(p.slug);
  await loadProviders();
  renderProviders();
}

// ------------------------------------------------------------------ add manual method
async function addManual(e) {
  e.preventDefault();
  const err = $("ap-add-err");
  const btn = $("ap-add-btn");
  const fail = (t) => {
    err.textContent = t;
    err.classList.remove("ap-hidden");
  };
  err.classList.add("ap-hidden");
  const name = $("ap-add-name").value.trim();
  const slug = $("ap-add-slug").value.trim().toLowerCase();
  if (name.length < 2) return fail("Enter the name buyers will see.");
  if (!/^[a-z0-9_-]{2,64}$/.test(slug)) return fail("The short code can only use lowercase letters, numbers, _ and -, 2 to 64 characters.");
  if (findProvider(slug)) return fail("That short code is already used.");
  btn.disabled = true;
  const { error } = await supabase.rpc("admin_create_manual_provider", { p_slug: slug, p_display_name: name, p_config: {} });
  btn.disabled = false;
  if (error) {
    return fail(error.code === "23505" ? "That short code is already used." : rpcMessage(error));
  }
  $("ap-add-name").value = "";
  $("ap-add-slug").value = "";
  flash("ok", `${name} added (switched off). Open its settings, add the payment instructions, then switch it on.`);
  await loadProviders();
  S.open.add(slug);
  renderProviders();
}

// ------------------------------------------------------------------ boot
function bindEvents() {
  $("ap-queue").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const g = findGroup(b.dataset.id);
    if (!g) return;
    if (b.dataset.act === "approve") decideManual(g, true);
    else if (b.dataset.act === "reject") decideManual(g, false);
    else if (b.dataset.act === "refund") resolveReview(g);
  });
  $("ap-providers").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const p = findProvider(b.dataset.slug);
    if (!p) return;
    if (b.dataset.act === "toggle") toggleProvider(p);
    else if (b.dataset.act === "edit") {
      if (S.open.has(p.slug)) S.open.delete(p.slug);
      else S.open.add(p.slug);
      renderProviders();
    } else if (b.dataset.act === "save") saveProvider(p, b);
  });
  $("ap-add-form").addEventListener("submit", addManual);
}

(async function boot() {
  const ctx = await requireRole(["admin", "super_admin"], "admin-dashboard.html");
  if (!ctx) return;

  const [qOk, pOk] = await Promise.all([loadQueue(), loadProviders(), loadHealth()]).then((r) => [r[0], r[1]]);
  $("ap-loading").classList.add("ap-hidden");
  if (!qOk && !pOk) {
    const f = $("ap-fatal");
    f.textContent = "We couldn't load payments. Check your connection and that you are signed in as an admin, then reload.";
    f.classList.remove("ap-hidden");
    return;
  }
  $("ap-main").classList.remove("ap-hidden");
  if (qOk) renderQueue();
  else $("ap-queue").innerHTML = '<div class="ap-banner bad">Couldn\'t load the payment queue. Reload to try again.</div>';
  if (pOk) renderProviders();
  else $("ap-providers").innerHTML = '<div class="ap-banner bad">Couldn\'t load the payment methods. Reload to try again.</div>';
  bindEvents();

  // Keep the queue fresh while the page is open (a buyer sending a reference shows up here).
  setInterval(async () => {
    if (document.visibilityState !== "visible" || document.getElementById("ap-modal")) return;
    if (await loadQueue()) renderQueue();
  }, 30000);
})();

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
