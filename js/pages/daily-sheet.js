// js/pages/daily-sheet.js
// One operator, several businesses: walk-in (counter) and online sales for
// every room the person owns or works in, from the operator_daily_sheet
// database function (days follow Africa/Gaborone).
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";
import { loadMyRooms, gaboroneDate, money } from "../core/my-rooms.js";

const METHOD_LABELS = {
  cash: "Cash",
  card: "Card",
  mobile_money: "Mobile money",
  bank_transfer: "Bank transfer",
  other: "Other",
  cod: "Cash on delivery",
  unknown: "Not recorded",
};

const $ = (id) => document.getElementById(id);
const state = { rooms: [], sheet: null, range: "today" };

function addDays(isoDate, n) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function presetRange(name) {
  const today = gaboroneDate();
  if (name === "yesterday") return [addDays(today, -1), addDays(today, -1)];
  if (name === "7d") return [addDays(today, -6), today];
  if (name === "month") return [today.slice(0, 8) + "01", today];
  return [today, today];
}

function setStatus(kind, text) {
  const el = $("status");
  if (!text) {
    el.style.display = "none";
    return;
  }
  el.style.display = "block";
  el.style.color = kind === "err" ? "#991B1B" : "#6B7280";
  el.textContent = text;
}

function roomName(id) {
  const r = (state.sheet?.rooms || []).find((x) => x.room_id === id);
  return r ? `Room ${r.room_number} — ${r.name}` : "Room";
}

function label(method) {
  return METHOD_LABELS[method] || method;
}

function table(el, head, rows, foot) {
  const th = head.map((h) => `<th class="${h.n ? "n" : ""}">${escapeHtml(h.t)}</th>`).join("");
  const body = rows
    .map((r) => "<tr>" + r.map((c, i) => `<td class="${head[i].n ? "n" : ""}">${c}</td>`).join("") + "</tr>")
    .join("");
  const f = foot ? "<tfoot><tr>" + foot.map((c, i) => `<td class="${head[i].n ? "n" : ""}"><b>${c}</b></td>`).join("") + "</tr></tfoot>" : "";
  el.innerHTML = `<thead><tr>${th}</tr></thead><tbody>${body || `<tr><td colspan="${head.length}" style="color:#9CA3AF;">Nothing recorded in this period.</td></tr>`}</tbody>${rows.length ? f : ""}`;
}

function render(sheet) {
  state.sheet = sheet;
  const t = sheet.totals;
  const multiDay = sheet.period.from !== sheet.period.to;

  $("kpis").innerHTML = [
    [money(t.grand_total), "Total sales"],
    [money(t.counter_total), `Walk-in · ${t.counter_count} sale${t.counter_count === 1 ? "" : "s"}`],
    [money(t.online_total), `Online · ${t.online_count} order${t.online_count === 1 ? "" : "s"}`],
    [t.avg_counter_spend === null ? "—" : money(t.avg_counter_spend), "Average walk-in sale"],
    [`${sheet.voids.count} · ${money(sheet.voids.total)}`, "Voided walk-in sales"],
  ]
    .map(([v, l]) => `<div class="kpi"><div class="v">${escapeHtml(v)}</div><div class="l">${escapeHtml(l)}</div></div>`)
    .join("");

  // by business
  const perRoom = new Map(sheet.rooms.map((r) => [r.room_id, { c: 0, cn: 0, o: 0, on: 0 }]));
  sheet.by_day.forEach((d) => {
    const a = perRoom.get(d.room_id);
    if (!a) return;
    a.c += Number(d.counter_total);
    a.cn += d.counter_count;
    a.o += Number(d.online_total);
    a.on += d.online_count;
  });
  table(
    $("by-room"),
    [{ t: "Business" }, { t: "Walk-in", n: 1 }, { t: "Sales", n: 1 }, { t: "Online", n: 1 }, { t: "Orders", n: 1 }, { t: "Total", n: 1 }],
    sheet.rooms.map((r) => {
      const a = perRoom.get(r.room_id);
      return [escapeHtml(`Room ${r.room_number} — ${r.name}`), money(a.c), a.cn, money(a.o), a.on, `<b>${money(a.c + a.o)}</b>`];
    }),
    ["All businesses", money(t.counter_total), t.counter_count, money(t.online_total), t.online_count, money(t.grand_total)]
  );

  // by day
  $("by-day-card").style.display = multiDay ? "block" : "none";
  const perDay = new Map();
  sheet.by_day.forEach((d) => {
    const a = perDay.get(d.day) || { c: 0, cn: 0, o: 0, on: 0 };
    a.c += Number(d.counter_total);
    a.cn += d.counter_count;
    a.o += Number(d.online_total);
    a.on += d.online_count;
    perDay.set(d.day, a);
  });
  table(
    $("by-day"),
    [{ t: "Day" }, { t: "Walk-in", n: 1 }, { t: "Sales", n: 1 }, { t: "Online", n: 1 }, { t: "Orders", n: 1 }, { t: "Total", n: 1 }],
    Array.from(perDay.keys())
      .sort()
      .map((day) => {
        const a = perDay.get(day);
        return [escapeHtml(day), money(a.c), a.cn, money(a.o), a.on, `<b>${money(a.c + a.o)}</b>`];
      })
  );

  // payments
  table(
    $("payments"),
    [{ t: "Channel" }, { t: "Method" }, { t: "Count", n: 1 }, { t: "Total", n: 1 }],
    sheet.payments.map((p) => [p.channel === "counter" ? "Walk-in" : "Online", escapeHtml(label(p.payment_method)), p.count, money(p.total)])
  );

  // customers
  const c = sheet.customers;
  $("customers").innerHTML =
    `<p style="margin:0 0 6px;"><b>${c.new}</b> new customer${c.new === 1 ? "" : "s"}</p>` +
    `<p style="margin:0 0 6px;"><b>${c.returning}</b> returning customer${c.returning === 1 ? "" : "s"}</p>` +
    `<p style="margin:0;color:#6B7280;"><b>${c.unidentified_sales}</b> sale${c.unidentified_sales === 1 ? "" : "s"} with no phone number or account</p>`;

  // best sellers
  const manyRooms = sheet.rooms.length > 1;
  const head = [{ t: "Product" }].concat(manyRooms ? [{ t: "Business" }] : [], [{ t: "Sold", n: 1 }, { t: "Walk-in", n: 1 }, { t: "Online", n: 1 }, { t: "Revenue", n: 1 }]);
  table(
    $("best"),
    head,
    sheet.best_sellers.slice(0, 15).map((b) =>
      [escapeHtml(b.product_name)].concat(manyRooms ? [escapeHtml(roomName(b.room_id))] : [], [b.quantity, b.counter_quantity, b.online_quantity, money(b.revenue)])
    )
  );

  $("report").style.display = "block";
}

async function run() {
  const from = $("from-date").value;
  const to = $("to-date").value;
  if (!from || !to || from > to) {
    setStatus("err", "Pick a valid date range (From must not be after To).");
    return;
  }
  setStatus("info", "Loading…");
  const roomId = $("room-filter").value;
  const { data, error } = await supabase.rpc("operator_daily_sheet", {
    p_from: from,
    p_to: to,
    p_room_ids: roomId ? [roomId] : null,
  });
  if (error) {
    console.error("[BSTM Sheet] Failed:", error);
    $("report").style.display = "none";
    setStatus("err", "Couldn't load the sheet: " + (error.message || "unknown error"));
    return;
  }
  setStatus("info", "");
  render(data);
}

function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // keep spreadsheets from running text as a formula
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCsv() {
  if (!state.sheet) return;
  const s = state.sheet;
  const byId = new Map(s.rooms.map((r) => [r.room_id, r]));
  const lines = [["day", "room_number", "room", "walkin_total", "walkin_sales", "online_total", "online_orders"]];
  s.by_day.forEach((d) => {
    const r = byId.get(d.room_id) || {};
    lines.push([d.day, r.room_number, r.name, Number(d.counter_total).toFixed(2), d.counter_count, Number(d.online_total).toFixed(2), d.online_count]);
  });
  const blob = new Blob([lines.map((l) => l.map(csvCell).join(",")).join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bstm-daily-sheet-${s.period.from}_to_${s.period.to}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function applyRange(name) {
  state.range = name;
  document.querySelectorAll("#range-pills .pill").forEach((b) => b.classList.toggle("on", b.dataset.range === name));
  if (name !== "custom") {
    const [f, t] = presetRange(name);
    $("from-date").value = f;
    $("to-date").value = t;
    run();
  }
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

  const sel = $("room-filter");
  sel.innerHTML =
    '<option value="">All my businesses</option>' +
    rooms.map((r) => `<option value="${escapeHtml(r.id)}">Room ${escapeHtml(r.room_number)} — ${escapeHtml(r.name)}</option>`).join("");

  $("range-pills").addEventListener("click", (e) => {
    const b = e.target.closest("[data-range]");
    if (b) applyRange(b.dataset.range);
  });
  $("run-btn").addEventListener("click", () => {
    applyRange("custom");
    run();
  });
  sel.addEventListener("change", run);
  $("csv-btn").addEventListener("click", downloadCsv);

  $("sheet-content").style.display = "block";
  applyRange("today");
});
