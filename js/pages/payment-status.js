// js/pages/payment-status.js
// Where a buyer lands after placing an online-payment order: shows exactly where the payment
// stands and what to do next. It never decides that money arrived — it only displays what the
// payments service (provider check or staff confirmation) has recorded.
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";
import {
  getPaymentStatus,
  getPaymentGroupFromDb,
  getPaymentMethods,
  isMethodReady,
  startPayment,
  submitReference,
  newIdempotencyKey,
  recallPaymentKey,
  paymentErrorMessage,
  money,
  shortOrderRef,
  shortGroupRef,
  safeHttpsUrl,
  dispatchOrderToCabLink,
  ORDER_PAYMENT,
} from "../core/payments.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = escapeHtml;

const params = new URLSearchParams(window.location.search);
const groupParam = params.get("group") || "";
const orderParams = (params.get("orders") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const cancelledFlag = params.get("cancelled") === "1";
const errorParam = params.get("error") || "";
const providerParam = params.get("provider") || "";

const S = {
  gid: null,
  group: null, // payment group summary from the server
  rows: [], // order rows when there is no payment group yet
  dueAt: null, // earliest payment_due_at of the orders (ms), if known
  dueLoadedFor: null,
  softWarn: false, // showing database state because the payment service could not be reached
  busy: false,
  refError: null,
  retryMethods: null,
  retryChoice: providerParam || null,
  retryError: null,
  dispatched: false,
  dispatchResults: null,
  lastKey: "",
  pollTimer: null,
  deadlineHandled: false,
};

const $ = (id) => document.getElementById(id);

function showOnly(which) {
  $("ps-loading").classList.toggle("ps-hidden", which !== "loading");
  $("ps-fatal").classList.toggle("ps-hidden", which !== "fatal");
  $("ps-root").classList.toggle("ps-hidden", which !== "root");
}

function fatal(text) {
  $("ps-fatal-text").textContent = text;
  showOnly("fatal");
}

function toLogin() {
  const back = "payment-status.html" + window.location.search;
  window.location.href = "login.html?redirect=" + encodeURIComponent(back);
}

// ------------------------------------------------------------------ data
async function loadOrderRows(ids) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, total_amount, payment_method, payment_status, payment_group_id, payment_due_at")
    .in("id", ids);
  if (error) return { ok: false, rows: [] };
  return { ok: true, rows: data || [] };
}

function rowsAsOrders(rows) {
  return rows.map((o) => ({ id: o.id, amount: o.total_amount, status: o.status, payment_status: o.payment_status }));
}

function currentOrders() {
  if (S.group && Array.isArray(S.group.orders)) return S.group.orders;
  return rowsAsOrders(S.rows);
}

// An attempt can be retried while every order is still open and unpaid.
function canRetry(orders) {
  return (
    orders.length > 0 &&
    orders.every((o) => o.status === "pending" && (o.payment_status === "unpaid" || o.payment_status === "failed"))
  );
}

async function loadDeadline() {
  if (!S.group || !Array.isArray(S.group.orders) || S.group.orders.length === 0) return;
  if (S.dueLoadedFor === S.group.id) return;
  S.dueLoadedFor = S.group.id;
  const r = await loadOrderRows(S.group.orders.map((o) => o.id));
  const times = r.rows.map((o) => (o.payment_due_at ? Date.parse(o.payment_due_at) : NaN)).filter((t) => Number.isFinite(t));
  S.dueAt = times.length ? Math.min(...times) : null;
}

function deadlineMs() {
  const g = S.group;
  if (!g) return null;
  const a = g.expires_at ? Date.parse(g.expires_at) : NaN;
  const b = S.dueAt;
  const list = [a, b].filter((t) => Number.isFinite(t));
  return list.length ? Math.min(...list) : null;
}

async function refresh(userInitiated) {
  if (!S.gid) return;
  const r = await getPaymentStatus(S.gid);
  if (r.ok && r.group) {
    S.group = r.group;
    S.softWarn = false;
  } else if (r.status === 401) {
    toLogin();
    return;
  } else if (r.status === 404) {
    fatal("We couldn't find that payment. Check the link, or open your orders to see where each one stands.");
    return;
  } else {
    // The payment service could not be reached: show what the database knows instead.
    const d = await getPaymentGroupFromDb(S.gid);
    if (d.ok && d.group) {
      S.group = d.group;
      S.softWarn = true;
    } else if (!S.group) {
      fatal("We couldn't load this payment right now. Please check your connection and try again.");
      return;
    } else {
      S.softWarn = true;
    }
  }
  await loadDeadline();
  render();
  schedulePoll();
  if (S.group && S.group.status === "succeeded") afterSuccess();
  if (userInitiated) S.busy = false;
}

function pollInterval() {
  const g = S.group;
  if (!g) return 0;
  if (g.status === "pending") return g.kind === "gateway" ? 5000 : 20000;
  if (g.status === "awaiting_confirmation") return 20000;
  return 0;
}

function schedulePoll() {
  clearTimeout(S.pollTimer);
  const ms = pollInterval();
  if (!ms) return;
  S.pollTimer = setTimeout(async () => {
    if (document.visibilityState === "visible") await refresh(false);
    else schedulePoll();
  }, ms);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && S.gid && pollInterval()) refresh(false);
});

// ------------------------------------------------------------------ views
function pill(ps) {
  const st = ORDER_PAYMENT[ps];
  return `<span class="ps-pill ${esc(ps)}">${esc(st ? st.label : ps)}</span>`;
}

function orderList(orders) {
  if (!orders || orders.length === 0) return "";
  return (
    '<div class="ps-orders">' +
    orders
      .map(
        (o) =>
          `<a class="ps-order" href="order-tracking.html?order=${encodeURIComponent(o.id)}">` +
          `<span><b>${esc(shortOrderRef(o.id))}</b> ${pill(o.payment_status)}</span>` +
          `<span>${esc(money(o.amount))}</span></a>`
      )
      .join("") +
    "</div>"
  );
}

function head(kind, icon, title, sub) {
  return (
    `<div class="ps-icon ${kind}"><i class="fas ${icon}"></i></div>` +
    `<p class="ps-title">${esc(title)}</p>` +
    (sub ? `<p class="ps-sub">${esc(sub)}</p>` : "")
  );
}

function countdownHtml() {
  const d = deadlineMs();
  if (!d) return "";
  return `<p class="ps-sub" style="margin-top:14px;">Your order is reserved for <span class="ps-count" id="ps-countdown" data-deadline="${d}"></span></p>`;
}

function softWarnHtml() {
  return S.softWarn
    ? '<div class="ps-banner info">We couldn\'t reach the payment service just now, so this may be a few moments behind. We\'ll keep trying.</div>'
    : "";
}

function viewPendingGateway(g) {
  const url = safeHttpsUrl(g.checkout_url);
  const ids = (g.orders || []).map((o) => o.id);
  const hasKey = !!recallPaymentKey(g.provider, ids);
  let action;
  if (url) {
    action = `<a class="ps-btn" href="${esc(url)}">Continue to payment</a>`;
  } else if (hasKey) {
    action = `<button class="ps-btn" id="ps-resume" ${S.busy ? "disabled" : ""}>Finish setting up my payment</button>`;
  } else {
    action =
      '<div class="ps-banner warn">Your payment page didn\'t finish opening. It will expire on its own, after which you can try again.</div>';
  }
  return (
    softWarnHtml() +
    (cancelledFlag
      ? '<div class="ps-banner warn">You left the payment page without paying. Your order is still reserved — continue below to pay.</div>'
      : "") +
    head("wait", "fa-credit-card", "Complete your payment", "Pay on the secure " + (g.provider_name || "provider") + " page.") +
    `<div class="ps-amount">${esc(money(g.amount))}</div>` +
    `<div class="ps-method">${esc(g.provider_name || g.provider)}</div>` +
    action +
    `<button class="ps-btn-alt" id="ps-check" ${S.busy ? "disabled" : ""}>${S.busy ? "Checking…" : "I've paid — check now"}</button>` +
    '<div class="ps-note">Already paid? This page updates by itself as soon as the provider confirms it. Please don\'t pay twice — if money left your account and this still says pending, wait a minute and press <b>I\'ve paid</b>.</div>' +
    orderList(g.orders) +
    countdownHtml()
  );
}

function instructionRows(ins) {
  const rows = [];
  const kv = (k, v) => rows.push(`<div class="ps-kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`);
  if (ins.account) kv(ins.account_label || "Account", ins.account);
  if (ins.bank) kv("Bank", ins.bank);
  if (ins.branch_code) kv("Branch code", ins.branch_code);
  if (ins.ussd) kv("USSD", ins.ussd);
  return rows.join("") + (ins.instructions ? `<div class="ps-instr">${esc(ins.instructions)}</div>` : "");
}

function refForm(g, label, prefill) {
  return (
    '<form id="ps-ref-form" novalidate>' +
    `<label class="ps-label" for="ps-ref-input">${esc(label)}</label>` +
    `<input class="ps-input" id="ps-ref-input" type="text" maxlength="64" autocomplete="off" placeholder="e.g. the code in your payment SMS or receipt" value="${esc(prefill || "")}">` +
    (S.refError ? `<p class="ps-err">${esc(S.refError)}</p>` : "") +
    `<button class="ps-btn" type="submit" ${S.busy ? "disabled" : ""}>${S.busy ? "Sending…" : prefill ? "Update reference" : "I've paid — send my reference"}</button>` +
    "</form>"
  );
}

function viewPendingManual(g) {
  return (
    softWarnHtml() +
    head("wait", "fa-mobile-alt", "Pay with " + (g.provider_name || g.provider), "Follow the steps, then send us your payment reference.") +
    `<div class="ps-amount">${esc(money(g.amount))}</div>` +
    '<p class="ps-method">Use this reference when you pay, if the form asks for one:</p>' +
    `<div class="ps-ref">${esc(shortGroupRef(g.id))}</div>` +
    instructionRows(g.instructions || {}) +
    refForm(g, "Your payment reference", "") +
    '<div class="ps-note">Our team confirms manual payments by hand. Once we see your payment your order is confirmed automatically — you don\'t need to do anything else.</div>' +
    orderList(g.orders) +
    countdownHtml()
  );
}

function viewAwaiting(g) {
  return (
    softWarnHtml() +
    head("wait", "fa-hourglass-half", "Waiting for confirmation", "We've received your reference and our team is checking it.") +
    `<div class="ps-amount">${esc(money(g.amount))}</div>` +
    `<div class="ps-method">${esc(g.provider_name || g.provider)}</div>` +
    `<div class="ps-kv"><span>Your reference</span><span>${esc(g.payer_reference || "—")}</span></div>` +
    '<div class="ps-note">This page updates by itself. Typed the wrong reference? Correct it below.</div>' +
    refForm(g, "Correct your reference", g.payer_reference || "") +
    orderList(g.orders) +
    countdownHtml()
  );
}

function dispatchHtml() {
  if (!S.dispatchResults) return "";
  const lines = S.dispatchResults
    .filter((d) => d.res === "sent" || d.res === "already" || d.res === "queued")
    .map((d) =>
      d.res === "queued"
        ? `<li>${esc(shortOrderRef(d.id))}: CabLink couldn't take the delivery request just now. It's saved — you can resend it from the order page.</li>`
        : `<li>${esc(shortOrderRef(d.id))}: delivery request sent to a CabLink driver.</li>`
    );
  return lines.length ? `<div class="ps-note"><ul style="margin:0;padding-left:18px;">${lines.join("")}</ul></div>` : "";
}

function viewSucceeded(g) {
  return (
    head("ok", "fa-check", "Payment received", "Thank you — your order is confirmed.") +
    `<div class="ps-amount">${esc(money(g.amount))}</div>` +
    `<div class="ps-method">${esc(g.provider_name || g.provider)}</div>` +
    (g.payer_reference ? `<div class="ps-kv"><span>Provider reference</span><span>${esc(g.payer_reference)}</span></div>` : "") +
    orderList(g.orders) +
    dispatchHtml() +
    '<a class="ps-btn" href="order-tracking.html">View my orders</a>'
  );
}

function retryPanel(orders) {
  if (!canRetry(orders)) {
    return (
      '<div class="ps-note">These orders were cancelled and the items released back to the shop. ' +
      'You can place a new order from the <a href="marketplace.html" style="color:#6d28d9;font-weight:700;">Mall</a>.</div>'
    );
  }
  if (S.retryMethods === null) return '<div class="ps-note">Loading payment options…</div>';
  if (S.retryMethods.length === 0) {
    return (
      '<div class="ps-note">No online payment method is available right now. ' +
      'Your orders are still reserved for a while — come back later, or place a new order with Cash on Delivery.</div>'
    );
  }
  const choice = S.retryMethods.some((m) => m.slug === S.retryChoice) ? S.retryChoice : S.retryMethods[0].slug;
  S.retryChoice = choice;
  return (
    '<p class="ps-label" style="margin-top:18px;">Try again with:</p>' +
    S.retryMethods
      .map(
        (m) =>
          `<label class="ps-radio ${m.slug === choice ? "sel" : ""}"><input type="radio" name="ps-retry" value="${esc(m.slug)}" ${m.slug === choice ? "checked" : ""}>` +
          `<span><b>${esc(m.name)}</b><small>${esc(m.description || "")}</small></span></label>`
      )
      .join("") +
    (S.retryError ? `<p class="ps-err">${esc(S.retryError)}</p>` : "") +
    `<button class="ps-btn" id="ps-retry" ${S.busy ? "disabled" : ""}>${S.busy ? "Starting…" : "Pay with this method"}</button>`
  );
}

function viewFailed(g) {
  const titles = {
    failed: ["bad", "fa-times", "Payment not completed"],
    cancelled: ["warn", "fa-ban", "Payment cancelled"],
    expired: ["warn", "fa-clock", "Payment window expired"],
  };
  const [kind, icon, title] = titles[g.status] || titles.failed;
  return (
    softWarnHtml() +
    head(kind, icon, title, "This payment attempt didn't complete.") +
    `<div class="ps-amount">${esc(money(g.amount))}</div>` +
    `<div class="ps-method">${esc(g.provider_name || g.provider)}</div>` +
    '<div class="ps-note" style="margin-top:0;margin-bottom:12px;">If money left your account for this attempt, please contact support with the order number so we can check it.</div>' +
    orderList(g.orders) +
    retryPanel(g.orders || [])
  );
}

function viewReview(g) {
  return (
    head("review", "fa-search", "Payment under review", "Please don't pay again.") +
    `<div class="ps-amount">${esc(money(g.amount))}</div>` +
    `<div class="ps-method">${esc(g.provider_name || g.provider)}</div>` +
    '<div class="ps-banner warn">We received a payment that needs a manual check (for example the amount didn\'t match). Our team will contact you, and any money that was taken will be refunded if the order can\'t go ahead.</div>' +
    orderList(g.orders) +
    '<a class="ps-btn-alt" href="help.html">Contact support</a>'
  );
}

function viewRefunded(g) {
  return (
    head("ok", "fa-undo", "Payment refunded", "This payment was refunded.") +
    `<div class="ps-amount">${esc(money(g.amount))}</div>` +
    (g.failure_reason ? `<div class="ps-banner info">${esc(g.failure_reason)}</div>` : "") +
    orderList(g.orders) +
    '<a class="ps-btn-alt" href="order-tracking.html">View my orders</a>'
  );
}

// No payment group exists yet (the payment couldn't be started from checkout).
function viewNoGroup() {
  const orders = rowsAsOrders(S.rows);
  const msg = errorParam ? paymentErrorMessage(errorParam) : "Your payment hasn't been started yet.";
  const open = canRetry(orders);
  const total = S.rows.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  return (
    head(open ? "warn" : "bad", open ? "fa-exclamation" : "fa-ban", open ? "Your order is waiting for payment" : "These orders can't be paid", msg) +
    (open ? `<div class="ps-amount">${esc(money(total))}</div>` : "") +
    orderList(orders) +
    retryPanel(orders)
  );
}

function viewFor() {
  const g = S.group;
  if (!g) return viewNoGroup();
  switch (g.status) {
    case "pending":
      return g.kind === "manual" ? viewPendingManual(g) : viewPendingGateway(g);
    case "awaiting_confirmation":
      return viewAwaiting(g);
    case "succeeded":
      return viewSucceeded(g);
    case "failed":
    case "cancelled":
    case "expired":
      return viewFailed(g);
    case "review":
      return viewReview(g);
    case "refunded":
      return viewRefunded(g);
    default:
      return head("wait", "fa-question", "Payment status unknown", "Please open your orders to see where things stand.");
  }
}

function needsRetryMethods() {
  const g = S.group;
  const orders = currentOrders();
  const failedView = !g || ["failed", "cancelled", "expired"].includes(g.status);
  return failedView && canRetry(orders);
}

function render() {
  const g = S.group;
  const orders = currentOrders();
  const key = JSON.stringify([
    g && [g.status, g.checkout_url, g.payer_reference, g.failure_reason, g.expires_at],
    orders.map((o) => [o.id, o.status, o.payment_status]),
    S.refError,
    S.retryError,
    S.retryMethods && S.retryMethods.map((m) => m.slug),
    S.retryChoice,
    S.busy,
    S.softWarn,
    S.dueAt,
    S.dispatchResults,
  ]);
  if (key === S.lastKey) return;
  S.lastKey = key;

  const root = $("ps-root");
  const typed = document.getElementById("ps-ref-input");
  const keep = typed ? typed.value : null;
  root.innerHTML = '<div class="ps-card">' + viewFor() + "</div>";
  showOnly("root");
  const input = document.getElementById("ps-ref-input");
  if (input && keep !== null && keep !== "") input.value = keep;
  bind();
  tickCountdown();

  if (needsRetryMethods() && S.retryMethods === null) loadRetryMethods();
}

// ------------------------------------------------------------------ actions
async function loadRetryMethods() {
  S.retryMethods = await getPaymentMethods();
  S.lastKey = "";
  render();
}

function goToGroup(group) {
  const url = group.kind === "gateway" ? safeHttpsUrl(group.checkout_url) : null;
  window.location.href = url || "payment-status.html?group=" + encodeURIComponent(group.id);
}

async function doRetry() {
  const slug = S.retryChoice;
  const orders = currentOrders();
  if (!slug || !canRetry(orders)) return;
  S.busy = true;
  S.retryError = null;
  render();
  if (!(await isMethodReady(slug))) {
    S.busy = false;
    S.retryError = paymentErrorMessage("provider_not_configured");
    S.retryMethods = await getPaymentMethods();
    S.lastKey = "";
    render();
    return;
  }
  const pay = await startPayment({ provider: slug, orderIds: orders.map((o) => o.id), idempotencyKey: newIdempotencyKey() });
  if (pay.ok && pay.group) {
    goToGroup(pay.group);
    return;
  }
  if (pay.groupId && pay.groupId !== (S.group && S.group.id)) {
    window.location.href = "payment-status.html?group=" + encodeURIComponent(pay.groupId);
    return;
  }
  S.busy = false;
  S.retryError = paymentErrorMessage(pay.error);
  S.lastKey = "";
  render();
}

async function doResume() {
  const g = S.group;
  if (!g) return;
  const ids = (g.orders || []).map((o) => o.id);
  const key = recallPaymentKey(g.provider, ids);
  if (!key) return;
  S.busy = true;
  render();
  const pay = await startPayment({ provider: g.provider, orderIds: ids, idempotencyKey: key });
  S.busy = false;
  if (pay.ok && pay.group) {
    if (safeHttpsUrl(pay.group.checkout_url) && pay.group.kind === "gateway") {
      window.location.href = safeHttpsUrl(pay.group.checkout_url);
      return;
    }
    S.group = pay.group;
  }
  S.lastKey = "";
  await refresh(false);
}

async function doSubmitReference() {
  const input = document.getElementById("ps-ref-input");
  const value = input ? input.value.trim() : "";
  if (value.length < 4) {
    S.refError = paymentErrorMessage("reference_invalid");
    S.lastKey = "";
    render();
    return;
  }
  S.busy = true;
  S.refError = null;
  render();
  const r = await submitReference(S.gid, value);
  S.busy = false;
  if (r.ok) {
    if (r.group && r.group.id) S.group = r.group;
    S.lastKey = "";
    await refresh(false);
  } else {
    S.refError = paymentErrorMessage(r.error);
    S.lastKey = "";
    render();
  }
}

async function afterSuccess() {
  if (S.dispatched || !S.group) return;
  S.dispatched = true;
  const out = [];
  for (const o of S.group.orders || []) {
    let res = "queued";
    try {
      res = await dispatchOrderToCabLink(o.id);
    } catch {
      res = "queued";
    }
    out.push({ id: o.id, res });
  }
  S.dispatchResults = out;
  render();
}

function bind() {
  const check = document.getElementById("ps-check");
  if (check)
    check.addEventListener("click", async () => {
      S.busy = true;
      render();
      await refresh(true);
      S.busy = false;
      S.lastKey = "";
      render();
    });
  const form = document.getElementById("ps-ref-form");
  if (form)
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      doSubmitReference();
    });
  const retry = document.getElementById("ps-retry");
  if (retry) retry.addEventListener("click", doRetry);
  const resume = document.getElementById("ps-resume");
  if (resume) resume.addEventListener("click", doResume);
  document.querySelectorAll('input[name="ps-retry"]').forEach((r) => {
    r.addEventListener("change", () => {
      S.retryChoice = r.value;
      document.querySelectorAll(".ps-radio").forEach((l) => l.classList.toggle("sel", l.querySelector("input").checked));
    });
  });
}

// ------------------------------------------------------------------ countdown
function tickCountdown() {
  const el = document.getElementById("ps-countdown");
  if (!el) return;
  const left = Number(el.dataset.deadline) - Date.now();
  if (left <= 0) {
    el.textContent = "0 min — checking…";
    if (!S.deadlineHandled) {
      S.deadlineHandled = true;
      setTimeout(() => refresh(false), 1500);
    }
    return;
  }
  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  const h = Math.floor(mins / 60);
  el.textContent = h > 0 ? `${h} h ${mins % 60} min` : `${mins} min ${String(secs).padStart(2, "0")} s`;
}
setInterval(tickCountdown, 1000);

// ------------------------------------------------------------------ boot
window.BSTM.ready().then(async function (session) {
  if (!session) {
    toLogin();
    return;
  }

  let gid = UUID_RE.test(groupParam) ? groupParam : null;

  if (!gid) {
    if (orderParams.length === 0 || orderParams.length > 20 || !orderParams.every((id) => UUID_RE.test(id))) {
      fatal("This page needs a payment or order reference. Open your orders to find it.");
      return;
    }
    const r = await loadOrderRows(orderParams);
    if (!r.ok) {
      fatal("We couldn't load those orders right now. Please try again.");
      return;
    }
    if (r.rows.length === 0) {
      fatal("We couldn't find those orders on your account.");
      return;
    }
    S.rows = r.rows;
    const withGroup = r.rows.find((o) => o.payment_group_id);
    if (withGroup) gid = withGroup.payment_group_id;
  }

  if (!gid) {
    render();
    return;
  }

  S.gid = gid;
  await refresh(false);
});
