// js/pages/counter.js
// The till: records walk-in (counter) sales into counter_sales through the
// record_counter_sale function. Walk-in sales never touch the online `orders`
// pipeline (no delivery dispatch, no buyer notifications).
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";
import { loadMyRooms, pickRoom, roomIdFromUrl, TZ, gaboroneDate, money } from "../core/my-rooms.js";

const PAY_METHODS = [
  ["cash", "Cash"],
  ["card", "Card"],
  ["mobile_money", "Mobile money"],
  ["bank_transfer", "Bank transfer"],
  ["other", "Other"],
];

const state = { room: null, rooms: [], products: [], cart: [], pay: "cash", ref: null, busy: false, customSeq: 0 };
const $ = (id) => document.getElementById(id);

// localStorage is only a convenience (remembered room / payment method).
const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
};

function newRef() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

const cents = (n) => Math.round(Number(n) * 100);
const cartTotalCents = () => state.cart.reduce((s, l) => s + cents(l.unit_price) * l.qty, 0);

function timeLabel(iso) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

function showMsg(kind, html) {
  const el = $("sale-msg");
  el.className = "msg " + kind;
  el.innerHTML = html;
  el.style.display = "block";
}
function hideMsg() { $("sale-msg").style.display = "none"; }

// ---------- catalogue ----------
async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, quantity, shelf, product_type, status")
    .eq("room_id", state.room.id)
    .in("status", ["active", "sold_out"])
    .order("name", { ascending: true });
  if (error) {
    console.error("[BSTM Counter] Couldn't load products:", error);
    $("product-groups").innerHTML = '<p class="msg err">Couldn\'t load products. Check your connection and reload.</p>';
    return;
  }
  state.products = data || [];
  renderProducts();
}

function renderProducts() {
  const q = $("search").value.trim().toLowerCase();
  const list = state.products.filter(
    (p) => !q || (p.name || "").toLowerCase().includes(q) || (p.shelf || "").toLowerCase().includes(q)
  );
  const box = $("product-groups");
  if (state.products.length === 0) {
    box.innerHTML =
      '<p style="color:#9CA3AF;font-size:14px;margin-top:14px;">This room has no products yet. Add some on the ' +
      '<a href="upload-product.html?room=' + encodeURIComponent(state.room.id) + '" style="color:#7C3AED;font-weight:700;">upload page</a>, or use a custom item below.</p>';
    return;
  }
  if (list.length === 0) {
    box.innerHTML = '<p style="color:#9CA3AF;font-size:14px;margin-top:14px;">No products match.</p>';
    return;
  }
  const groups = new Map();
  list.forEach((p) => {
    const k = p.shelf || "";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  });
  const keys = Array.from(groups.keys()).sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  const showHeads = !(keys.length === 1 && keys[0] === "");
  box.innerHTML = keys
    .map((k) => {
      const tiles = groups
        .get(k)
        .map((p) => {
          const physical = p.product_type === "physical";
          const stock = physical
            ? `<div class="st ${p.quantity > 0 ? "" : "low"}">${Number(p.quantity) || 0} in stock</div>`
            : '<div class="st">Service</div>';
          return `<button type="button" class="tile" data-pid="${escapeHtml(p.id)}">
            <div class="nm">${escapeHtml(p.name)}</div>
            <div class="pr">${money(p.price)}</div>${stock}</button>`;
        })
        .join("");
      const head = showHeads ? `<div class="shelf-h">${escapeHtml(k || "Other items")}</div>` : "";
      return `${head}<div class="grid-tiles">${tiles}</div>`;
    })
    .join("");
}

// ---------- cart ----------
function touchCart() {
  // The sale reference is created when the cart first gets an item and is kept
  // until the sale is confirmed. Retrying after a bad network therefore can
  // never record the same sale twice (the server returns the original).
  if (state.cart.length > 0 && !state.ref) state.ref = newRef();
  if (state.cart.length === 0) state.ref = null;
  hideMsg();
  renderCart();
}

function addProduct(p) {
  const price = Number(p.price);
  if (!(price >= 0)) return;
  const line = state.cart.find((l) => l.product_id === p.id);
  if (line) {
    line.qty = Math.min(line.qty + 1, 10000);
  } else {
    state.cart.push({
      key: p.id,
      product_id: p.id,
      name: p.name,
      unit_price: price,
      qty: 1,
      stock: p.product_type === "physical" ? Number(p.quantity) || 0 : null,
    });
  }
  touchCart();
}

function renderCart() {
  const box = $("cart-lines");
  if (state.cart.length === 0) {
    box.innerHTML = '<p style="color:#9CA3AF;font-size:13px;margin:0;">Tap a product to add it.</p>';
  } else {
    box.innerHTML = state.cart
      .map((l) => {
        const over = l.stock !== null && l.qty > l.stock;
        const warn = over
          ? `<div style="font-size:11px;color:#B45309;font-weight:600;">Stock shows ${l.stock}. Selling anyway will set the count to 0 — recount later.</div>`
          : "";
        return `<div style="border-bottom:1px solid #F3F4F6;padding:8px 0;">
          <div style="display:flex;justify-content:space-between;gap:8px;">
            <span style="font-weight:700;color:#1E1B4B;font-size:14px;">${escapeHtml(l.name)}${l.product_id ? "" : ' <span style="font-size:11px;color:#9CA3AF;">(custom)</span>'}</span>
            <span style="font-weight:800;">${money((cents(l.unit_price) * l.qty) / 100)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
            <button type="button" class="qbtn" data-act="dec" data-key="${escapeHtml(l.key)}">−</button>
            <span style="min-width:28px;text-align:center;font-weight:800;">${l.qty}</span>
            <button type="button" class="qbtn" data-act="inc" data-key="${escapeHtml(l.key)}">+</button>
            <span style="font-size:12px;color:#9CA3AF;">× ${money(l.unit_price)}</span>
            <button type="button" data-act="rm" data-key="${escapeHtml(l.key)}" style="margin-left:auto;background:none;border:none;color:#DC2626;font-weight:700;font-size:12px;cursor:pointer;">Remove</button>
          </div>${warn}</div>`;
      })
      .join("");
  }
  $("cart-total").textContent = money(cartTotalCents() / 100);
  $("record-btn").disabled = state.busy || state.cart.length === 0 || cartTotalCents() <= 0;
  $("record-btn").textContent = state.busy ? "Recording…" : "Record sale";
  $("clear-btn").style.display = state.cart.length > 0 && !state.busy ? "block" : "none";
}

function renderPayMethods() {
  $("pay-methods").innerHTML = PAY_METHODS.map(
    ([id, label]) => `<button type="button" class="pill ${state.pay === id ? "on" : ""}" data-pay="${id}">${label}</button>`
  ).join("");
}

// ---------- recording ----------
function resetSale() {
  state.cart = [];
  state.ref = null;
  $("cust-phone").value = "";
  $("cust-note").value = "";
  renderCart();
}

async function recordSale() {
  if (state.busy || state.cart.length === 0) return;
  state.busy = true;
  hideMsg();
  renderCart();

  const expected = cartTotalCents();
  const items = state.cart.map((l) =>
    l.product_id
      ? { product_id: l.product_id, quantity: l.qty }
      : { name: l.name, unit_price: (cents(l.unit_price) / 100).toFixed(2), quantity: l.qty }
  );

  let result;
  try {
    result = await supabase.rpc("record_counter_sale", {
      p_room_id: state.room.id,
      p_items: items,
      p_payment_method: state.pay,
      p_client_ref: state.ref,
      p_customer_phone: $("cust-phone").value.trim() || null,
      p_note: $("cust-note").value.trim() || null,
    });
  } catch (e) {
    result = { data: null, error: { message: String((e && e.message) || e), code: "" } };
  }
  state.busy = false;

  const { data, error } = result;
  if (error) {
    console.error("[BSTM Counter] Sale failed:", error);
    if (!error.code) {
      showMsg(
        "err",
        "Couldn't reach the server, so this sale is <b>not confirmed yet</b>. Press <b>Record sale</b> again — it is safe to retry and will not be counted twice."
      );
    } else {
      showMsg("err", "Sale not recorded: " + escapeHtml(error.message || "unknown error"));
    }
    renderCart();
    return;
  }

  const total = cents(data.total_amount);
  if (data.replayed) {
    const diff = total !== expected ? ` The recorded amount (${money(total / 100)}) differs from this cart (${money(expected / 100)}) — check today's list below.` : "";
    showMsg("warn", `This sale was already recorded earlier (${money(total / 100)}), so nothing was added again.${diff}`);
  } else {
    let html = `✅ Recorded ${money(total / 100)} · ${escapeHtml(PAY_METHODS.find((m) => m[0] === state.pay)?.[1] || state.pay)}`;
    const clamped = Array.isArray(data.stock_clamped) ? data.stock_clamped : [];
    if (clamped.length > 0) {
      html +=
        "<br><b>Recount needed:</b> " +
        clamped
          .map((c) => `${escapeHtml(c.name)} (stock showed ${Number(c.stock_before)}, you sold ${Number(c.requested)} — count set to 0)`)
          .join("; ");
    }
    showMsg(clamped.length > 0 ? "warn" : "ok", html);
  }

  resetSale();
  await Promise.all([loadProducts(), loadToday()]);
}

// ---------- today's sales ----------
async function loadToday() {
  const start = gaboroneDate() + "T00:00:00+02:00";
  const [{ data: rows, error }, sheet] = await Promise.all([
    supabase
      .from("counter_sales")
      .select("id, sold_at, payment_method, total_amount, customer_phone, note, voided_at, void_reason, counter_sale_items(product_name, quantity)")
      .eq("room_id", state.room.id)
      .gte("sold_at", start)
      .order("sold_at", { ascending: false })
      .limit(100),
    supabase.rpc("operator_daily_sheet", { p_from: gaboroneDate(), p_to: gaboroneDate(), p_room_ids: [state.room.id] }),
  ]);

  // Header totals come from the same function the daily sheet uses (exact, not limited to 100 rows).
  if (!sheet.error && sheet.data) {
    $("today-total").textContent = money(sheet.data.totals.counter_total);
    const n = Number(sheet.data.totals.counter_count) || 0;
    $("today-count").textContent = `${n} sale${n === 1 ? "" : "s"}` + (sheet.data.voids.count > 0 ? ` · ${sheet.data.voids.count} voided` : "");
  }

  const list = $("today-list");
  if (error) {
    console.error("[BSTM Counter] Couldn't load today's sales:", error);
    list.innerHTML = '<p class="msg err">Couldn\'t load today\'s sales.</p>';
    return;
  }
  $("today-note").textContent = (rows || []).length >= 100 ? "Showing the latest 100 sales." : "";
  if (!rows || rows.length === 0) {
    list.innerHTML = '<p style="color:#9CA3AF;font-size:13px;">No walk-in sales recorded yet today.</p>';
    return;
  }
  list.innerHTML = rows
    .map((s) => {
      const items = (s.counter_sale_items || []).map((i) => `${escapeHtml(i.product_name)} × ${Number(i.quantity)}`).join(", ");
      const method = (PAY_METHODS.find((m) => m[0] === s.payment_method) || [0, s.payment_method])[1];
      const voided = !!s.voided_at;
      const action = !voided && state.room.canVoid
        ? `<button type="button" data-void="${escapeHtml(s.id)}" style="background:none;border:none;color:#DC2626;font-weight:700;font-size:12px;cursor:pointer;">Void</button>`
        : voided
        ? `<span style="color:#DC2626;font-size:12px;font-weight:700;">VOIDED${s.void_reason ? ": " + escapeHtml(s.void_reason) : ""}</span>`
        : "";
      return `<div class="sale-row ${voided ? "void" : ""}">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <span><b>${timeLabel(s.sold_at)}</b> · ${escapeHtml(method)}${s.customer_phone ? " · " + escapeHtml(s.customer_phone) : ""}</span>
          <span style="font-weight:800;">${money(s.total_amount)}</span>
        </div>
        <div style="color:#6B7280;">${items}${s.note ? " — " + escapeHtml(s.note) : ""}</div>
        <div>${action}</div></div>`;
    })
    .join("");
}

async function voidSale(id) {
  const reason = window.prompt("Reason for voiding this sale?");
  if (reason === null) return;
  if (reason.trim().length < 3) {
    window.alert("Please give a reason (at least 3 characters).");
    return;
  }
  const { error } = await supabase.rpc("void_counter_sale", { p_sale_id: id, p_reason: reason.trim() });
  if (error) {
    console.error("[BSTM Counter] Void failed:", error);
    showMsg("err", "Couldn't void: " + escapeHtml(error.message || "unknown error"));
    return;
  }
  showMsg("ok", "Sale voided and stock restored.");
  await Promise.all([loadProducts(), loadToday()]);
}

// ---------- room selection ----------
async function selectRoom(room) {
  state.room = room;
  store.set("bstm.counter.room", room.id);
  $("room-title").textContent = `${room.banner_emoji || "🏪"} Room ${room.room_number} — ${room.name}`;
  resetSale();
  hideMsg();
  $("search").value = "";
  $("today-total").textContent = money(0);
  $("today-count").textContent = "";
  await Promise.all([loadProducts(), loadToday()]);
}

function bindEvents() {
  $("product-groups").addEventListener("click", (e) => {
    const tile = e.target.closest("[data-pid]");
    if (!tile) return;
    const p = state.products.find((x) => x.id === tile.dataset.pid);
    if (p) addProduct(p);
  });
  $("cart-lines").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const line = state.cart.find((l) => l.key === b.dataset.key);
    if (!line) return;
    if (b.dataset.act === "inc") line.qty = Math.min(line.qty + 1, 10000);
    else if (b.dataset.act === "dec") line.qty = Math.max(1, line.qty - 1);
    else state.cart = state.cart.filter((l) => l !== line);
    touchCart();
  });
  $("pay-methods").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pay]");
    if (!b) return;
    state.pay = b.dataset.pay;
    store.set("bstm.counter.pay", state.pay);
    renderPayMethods();
  });
  $("today-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-void]");
    if (b) voidSale(b.dataset.void);
  });
  $("search").addEventListener("input", renderProducts);
  $("record-btn").addEventListener("click", recordSale);
  $("clear-btn").addEventListener("click", () => {
    if (window.confirm("Clear the current sale?")) {
      resetSale();
      hideMsg();
    }
  });
  $("custom-add").addEventListener("click", () => {
    const name = $("custom-name").value.trim();
    const price = Math.round(parseFloat($("custom-price").value) * 100) / 100;
    if (!name || !(price > 0) || price > 1000000) {
      showMsg("err", "Enter what was sold and a price above 0.");
      return;
    }
    state.customSeq += 1;
    state.cart.push({ key: "custom-" + state.customSeq, product_id: null, name, unit_price: price, qty: 1, stock: null });
    $("custom-name").value = "";
    $("custom-price").value = "";
    touchCart();
  });
  $("room-switch").addEventListener("change", async () => {
    const next = state.rooms.find((r) => r.id === $("room-switch").value);
    if (!next || next.id === state.room.id) return;
    if (state.cart.length > 0 && !window.confirm("Switching room clears the current sale. Continue?")) {
      $("room-switch").value = state.room.id;
      return;
    }
    await selectRoom(next);
  });
}

window.BSTM.ready().then(async (session) => {
  if (!session) {
    $("auth-wall").style.display = "flex";
    return;
  }
  const { rooms } = await loadMyRooms(session.user.id);
  state.rooms = rooms;
  if (rooms.length === 0) {
    $("no-room").style.display = "flex";
    return;
  }

  const saved = store.get("bstm.counter.pay");
  if (saved && PAY_METHODS.some((m) => m[0] === saved)) state.pay = saved;

  const first = pickRoom(rooms, roomIdFromUrl() || store.get("bstm.counter.room"));
  if (rooms.length > 1) {
    const sw = $("room-switch");
    sw.innerHTML = rooms.map((r) => `<option value="${escapeHtml(r.id)}">Room ${escapeHtml(r.room_number)} — ${escapeHtml(r.name)}</option>`).join("");
    sw.value = first.id;
    sw.style.display = "block";
  }

  $("counter-content").style.display = "block";
  bindEvents();
  renderPayMethods();
  renderCart();
  await selectRoom(first);
});
