// js/core/nav-notifications.js
// Wires the bell icon in components/nav.html to real notifications.
// Depends on window.BSTM (set up by app.js) and runs once the nav
// markup has actually landed in the DOM (nav is injected async).
import { supabase } from "./supabase-client.js";
import { escapeHtml } from "./sanitize.js";

const ICONS = {
  order: { icon: "📦", color: "#7C3AED" },
  message: { icon: "💬", color: "#2563EB" },
};

let wired = false;
let currentUserId = null;
let panelNotifications = [];

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function renderPanel() {
  const list = document.getElementById("nav-notif-list");
  if (!list) return;

  if (panelNotifications.length === 0) {
    list.innerHTML = `<div style="padding:16px;color:#9CA3AF;font-size:13px;text-align:center;">No notifications yet</div>`;
    return;
  }

  list.innerHTML = panelNotifications
    .map((n) => {
      const style = ICONS[n.type] || { icon: "🔔", color: "#6B7280" };
      const link = n.data?.link || "notifications-all.html";
      return `
        <a href="${link}" data-id="${n.id}" class="nav-notif-item"
           style="display:flex;gap:10px;padding:10px 8px;border-radius:12px;text-decoration:none;${n.is_read ? "" : "background:#F5F3FF;"}">
          <div style="font-size:18px;flex-shrink:0;">${style.icon}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12.5px;font-weight:700;color:#1E1B4B;">${escapeHtml(n.title)}</div>
            <div style="font-size:11.5px;color:#6B7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(n.body || "")}</div>
            <div style="font-size:10px;color:#A78BFA;margin-top:2px;">${timeAgo(n.created_at)}</div>
          </div>
        </a>`;
    })
    .join("");

  list.querySelectorAll(".nav-notif-item").forEach((el) => {
    el.addEventListener("click", () => {
      supabase.from("notifications").update({ is_read: true }).eq("id", el.dataset.id);
    });
  });
}

function updateBadge(count) {
  const badge = document.getElementById("nav-notif-badge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? "9+" : String(count);
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}

async function loadNotifications() {
  if (!currentUserId) return;
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("[BSTM] nav notifications load failed:", error);
    return;
  }

  panelNotifications = data || [];
  renderPanel();
  updateBadge(panelNotifications.filter((n) => !n.is_read).length);
}

window.BSTM_markAllNavNotifsRead = async function () {
  if (!currentUserId) return;
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", currentUserId);
  panelNotifications = panelNotifications.map((n) => ({ ...n, is_read: true }));
  renderPanel();
  updateBadge(0);
};

function wireBellClick() {
  const btn = document.getElementById("notif-btn");
  const panel = document.getElementById("notif-panel");
  if (!btn || !panel || wired) return;
  wired = true;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) loadNotifications();
  });

  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && e.target !== btn) {
      panel.classList.remove("open");
    }
  });
}

// Re-run whenever nav.html (re)injects and whenever session/role changes,
// same event app.js already uses for role-filtering — keeps this in sync
// without inventing a new timing mechanism.
window.addEventListener("bstm:componentLoaded", wireBellClick);
window.addEventListener("bstm:ready", (e) => {
  currentUserId = e.detail?.user?.id || null;
  wireBellClick();
  if (currentUserId) loadNotifications();
});
window.addEventListener("bstm:login", (e) => {
  currentUserId = e.detail?.user?.id || null;
  if (currentUserId) loadNotifications();
});
window.addEventListener("bstm:logout", () => {
  currentUserId = null;
  panelNotifications = [];
  renderPanel();
  updateBadge(0);
});
