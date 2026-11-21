// js/core/workspaces.js
// ONE place that defines the five BSTM workspaces and everything about them:
//   buyer      - shopping: Mall, Farm, CabLink, wallet, cart, my orders
//   seller     - running a room: dashboard, products, counter, daily sheet, earnings
//   agent      - field agents (role "agent"): only the sections they were given
//   admin      - administrators (admin, super_admin): dashboard, payments, monitoring, control centre
//   government - oversight (role "government"): monitoring
// Each workspace has its own menu, its own home page (where login sends you) and
// its own set of pages. Nothing here creates or removes a page: it only decides
// which existing page belongs to which workspace and which menu shows it.

export const ORDER = ["buyer", "seller", "agent", "admin", "government"];

export const WORKSPACES = {
  buyer: {
    id: "buyer",
    label: "Buyer",
    icon: "🛍️",
    tagline: "Shop, pay and track your orders",
    accent: "#06502F",
    home: "buyer-dashboard.html",
    menu: [
      { href: "marketplace.html", label: "Mall", icon: "🏬", i18n: "nav.marketplace" },
      { href: "agriculture.html", label: "Farm", icon: "🌾", i18n: "nav.farm" },
      { href: "cablink.html", label: "CabLink", icon: "🚕", i18n: "nav.cablink" },
      { href: "buyer-dashboard.html", label: "My Orders", icon: "📦" },
      { href: "thb-wallet.html", label: "Wallet", icon: "💰", i18n: "nav.wallet" },
      { href: "checkout.html", label: "Cart", icon: "🛒", cart: true },
      {
        group: "More", icon: "⋯", items: [
          { href: "wishlist.html", label: "Wishlist", icon: "❤️" },
          { href: "messages.html", label: "Messages", icon: "💬" },
          { href: "transactions.html", label: "Transactions", icon: "📊" },
          { href: "help.html", label: "Help", icon: "❓", i18n: "nav.help" },
        ],
      },
    ],
  },
  seller: {
    id: "seller",
    label: "Seller",
    icon: "🏪",
    tagline: "Run your room: products, sales and earnings",
    accent: "#F5B301",
    home: "seller-dashboard.html",
    menu: [
      { href: "seller-dashboard.html", label: "My Room", icon: "🏪" },
      { href: "upload-product.html", label: "Add Product", icon: "📤" },
      { href: "counter.html", label: "Counter Sale", icon: "🧮" },
      { href: "daily-sheet.html", label: "Daily Sheet", icon: "📒" },
      { href: "earnings.html", label: "Earnings", icon: "💸" },
      {
        group: "More", icon: "⋯", items: [
          { href: "analytics.html", label: "Analytics", icon: "📈" },
          { href: "messages.html", label: "Messages", icon: "💬" },
          { href: "help.html", label: "Help", icon: "❓", i18n: "nav.help" },
        ],
      },
    ],
  },
  agent: {
    id: "agent",
    label: "Agent",
    icon: "🧭",
    tagline: "Your field-agent desk: the sections you were given",
    accent: "#E76F51",
    home: "admin-dashboard.html",
    menu: [
      { href: "admin-dashboard.html", label: "Agent Desk", icon: "🧭", roles: ["agent"] },
      { href: "messages.html", label: "Messages", icon: "💬" },
      { href: "help.html", label: "Help", icon: "❓", i18n: "nav.help" },
    ],
  },
  admin: {
    id: "admin",
    label: "Admin",
    icon: "🛡️",
    tagline: "Oversee payments, people and the platform",
    accent: "#CBD5E1",
    home: "admin-dashboard.html",
    menu: [
      { href: "admin-dashboard.html", label: "Admin", icon: "🧠", roles: ["admin", "super_admin"] },
      { href: "admin-payments.html", label: "Payments", icon: "💳", roles: ["admin", "super_admin"] },
      { href: "monitoring-dashboard.html", label: "Monitoring", icon: "📡", roles: ["admin", "super_admin"] },
      { href: "gov-dashboard.html", label: "Control Center", icon: "🎛", roles: ["super_admin"] },
      { href: "help.html", label: "Help", icon: "❓", i18n: "nav.help" },
    ],
  },
  government: {
    id: "government",
    label: "Government",
    icon: "🏛️",
    tagline: "Monitor the platform",
    accent: "#94A3B8",
    home: "monitoring-dashboard.html",
    menu: [
      { href: "monitoring-dashboard.html", label: "Monitoring", icon: "📡", roles: ["government"] },
      { href: "help.html", label: "Help", icon: "❓", i18n: "nav.help" },
    ],
  },
};

// Logged-out visitors: public pages only.
export const PUBLIC_MENU = [
  { href: "marketplace.html", label: "Mall", icon: "🏬", i18n: "nav.marketplace" },
  { href: "agriculture.html", label: "Farm", icon: "🌾", i18n: "nav.farm" },
  { href: "help.html", label: "Help", icon: "❓", i18n: "nav.help" },
];

// Personal pages shared by every workspace (also in the user menu at the top right).
export const ACCOUNT_MENU = [
  { href: "profile.html", label: "Profile", icon: "👤" },
  { href: "notifications-all.html", label: "Notifications", icon: "🔔" },
  { href: "kyc-verification.html", label: "Verify Identity", icon: "🪪" },
  { href: "settings.html", label: "Settings", icon: "⚙️" },
];

// Which workspace a page belongs to. A page listed here puts you in that
// workspace (when you have it). Pages not listed are shared account pages
// (profile, settings, notifications, identity, help, terms ...): they keep
// whichever workspace you were in.
export const PAGE_WORKSPACE = {
  // buyer
  "index.html": "buyer", "marketplace.html": "buyer", "agriculture.html": "buyer", "cablink.html": "buyer",
  "product-detail.html": "buyer", "room.html": "buyer", "checkout.html": "buyer", "order-tracking.html": "buyer",
  "payment-status.html": "buyer", "buyer-dashboard.html": "buyer", "wishlist.html": "buyer",
  "thb-wallet.html": "buyer", "transactions.html": "buyer", "ecosystem-hub.html": "buyer",
  // seller
  "seller-dashboard.html": "seller", "upload-product.html": "seller", "counter.html": "seller",
  "daily-sheet.html": "seller", "earnings.html": "seller", "analytics.html": "seller", "open-room.html": "seller",
  // staff
  "admin-dashboard.html": ["admin", "agent"], "admin-payments.html": "admin",
  "monitoring-dashboard.html": ["admin", "government"], "gov-dashboard.html": "admin",
};

// Same rule as requireSellerAccess() in bstm-core.js: seller/admin/super_admin by role, anyone else by room membership.
const SELLER_ROLES = ["seller", "admin", "super_admin"];

export function pageFile(pathname) {
  const f = String(pathname || "").split("?")[0].split("#")[0].split("/").pop();
  return (f || "index.html").toLowerCase();
}

// Which workspaces this person has. Everyone signed in has Buyer.
export function availableWorkspaces({ role, isRoomStaff } = {}) {
  const out = ["buyer"];
  if (SELLER_ROLES.includes(role) || isRoomStaff) out.push("seller");
  if (role === "agent") out.push("agent");
  if (role === "admin" || role === "super_admin") out.push("admin");
  if (role === "government") out.push("government");
  return ORDER.filter((id) => out.includes(id));
}

// Default home for someone with no remembered choice: staff first, then room people, then Buyer.
export function defaultWorkspace(available) {
  for (const id of ["admin", "government", "agent", "seller"]) if (available.includes(id)) return id;
  return "buyer";
}

// page wins (deep links keep their own workspace; a page shared by two workspaces keeps your current one),
// then the remembered choice, then the default.
export function resolveWorkspace({ page, available, stored }) {
  const own = [].concat(PAGE_WORKSPACE[page] || []).filter((id) => available.includes(id));
  if (own.length) return stored && own.includes(stored) ? stored : own[0];
  if (stored && available.includes(stored)) return stored;
  return defaultWorkspace(available);
}

export function homeFor(wsId) {
  return (WORKSPACES[wsId] || WORKSPACES.buyer).home;
}

// Menu entries this role may see in a workspace (entries with `roles` are filtered).
export function menuFor(wsId, role) {
  const ws = WORKSPACES[wsId] || WORKSPACES.buyer;
  const ok = (it) => !it.roles || it.roles.includes(role);
  return ws.menu
    .map((it) => (it.group ? { ...it, items: it.items.filter(ok) } : it))
    .filter((it) => (it.group ? it.items.length > 0 : ok(it)));
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function desktopLink(it) {
  const i18n = it.i18n ? ` data-i18n="${it.i18n}"` : "";
  const badge = it.cart ? '<span class="nav-cart-count" hidden></span>' : "";
  return `<a class="nav-link" href="${it.href}"${i18n}>${esc(it.label)}${badge}</a>`;
}

function desktopHtml(items) {
  return items
    .map((it) => {
      if (!it.group) return desktopLink(it);
      const links = it.items
        .map((l) => `<a href="${l.href}"${l.i18n ? ` data-i18n="${l.i18n}"` : ""}>${esc(l.label)}</a>`)
        .join("");
      return `<details class="nav-group"><summary class="nav-link">${esc(it.group)}</summary><div class="nav-menu">${links}</div></details>`;
    })
    .join("");
}

function mobileHtml(items) {
  const flat = [];
  items.forEach((it) => (it.group ? flat.push(...it.items) : flat.push(it)));
  return flat
    .map((it) => {
      const badge = it.cart ? '<span class="nav-cart-count" hidden></span>' : "";
      return `<a href="${it.href}">${it.icon || ""} ${esc(it.label)}${badge}</a>`;
    })
    .join("");
}

// Paint the header for the current state:
//   { session, role, available, current }
// Writes #desktop-nav, #mobile-menu, the workspace switch (#ws-switch) and the accent line.
export function renderWorkspaceNav(state, doc = document) {
  const desktop = doc.getElementById("desktop-nav");
  const mobile = doc.getElementById("mobile-menu");
  const bar = doc.getElementById("bstm-nav-bar");
  if (!desktop || !mobile) return false;

  const loggedIn = !!state.session;
  const ws = WORKSPACES[state.current] || WORKSPACES.buyer;
  const items = loggedIn ? menuFor(ws.id, state.role) : PUBLIC_MENU;

  desktop.innerHTML = desktopHtml(items);

  // ---- workspace switch (desktop chip + phone menu header) ----
  const switchEl = doc.getElementById("ws-switch");
  const options = loggedIn ? state.available.map((id) => WORKSPACES[id]) : [];
  const canOpenRoom = loggedIn && !state.available.includes("seller");
  let chip = "";
  let phoneHead = "";
  if (loggedIn) {
    const others = options.filter((o) => o.id !== ws.id);
    const rows = others
      .map((o) => `<button type="button" class="ws-option" data-ws="${o.id}">${o.icon} ${esc(o.label)} workspace<small>${esc(o.tagline)}</small></button>`)
      .join("");
    const open = canOpenRoom
      ? `<a class="ws-option" href="open-room.html">➕ Start selling<small>Open your own room</small></a>`
      : "";
    if (others.length || canOpenRoom) {
      chip = `<details class="nav-group ws-group"><summary class="ws-chip" aria-label="Workspace: ${esc(ws.label)}. Switch workspace">${ws.icon}<span class="ws-label"> ${esc(ws.label)}</span></summary><div class="nav-menu ws-menu"><div class="ws-current">You are in the <b>${esc(ws.label)}</b> workspace<small>${esc(ws.tagline)}</small></div>${rows}${open}</div></details>`;
    } else {
      chip = `<span class="ws-chip ws-static" title="${esc(ws.tagline)}">${ws.icon}<span class="ws-label"> ${esc(ws.label)}</span></span>`;
    }
    const seg = options
      .map((o) => `<button type="button" class="ws-seg${o.id === ws.id ? " on" : ""}" data-ws="${o.id}" aria-pressed="${o.id === ws.id}">${o.icon} ${esc(o.label)}</button>`)
      .join("");
    const startSelling = canOpenRoom ? `<a class="ws-start" href="open-room.html">➕ Start selling: open your own room</a>` : "";
    phoneHead = `<div class="ws-phone"><div class="ws-phone-label">${ws.icon} ${esc(ws.label)} workspace</div>${options.length > 1 ? `<div class="ws-segs">${seg}</div>` : ""}${startSelling}</div>`;
  }
  if (switchEl) {
    switchEl.innerHTML = chip;
    switchEl.hidden = !chip;
  }

  const account = loggedIn
    ? `<div class="mm-head">My Account</div>` + mobileHtml(ACCOUNT_MENU)
    : `<div class="mm-head">About</div><a href="terms.html">📘 Terms</a>`;
  mobile.innerHTML = phoneHead + mobileHtml(items) + account;
  if (bar) {
    bar.dataset.workspace = loggedIn ? ws.id : "public";
    bar.style.borderBottomColor = loggedIn ? ws.accent : "";
  }

  // current page highlight
  const here = pageFile(doc.defaultView ? doc.defaultView.location.pathname : "");
  doc.querySelectorAll("#desktop-nav a[href], #mobile-menu a[href]").forEach((a) => {
    if (((a.getAttribute("href") || "").split("?")[0]).toLowerCase() === here) {
      a.classList.add("is-active");
      a.setAttribute("aria-current", "page");
      const group = a.closest(".nav-group");
      if (group) group.querySelector("summary").classList.add("is-active");
    }
  });
  return true;
}
