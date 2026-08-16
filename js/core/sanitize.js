// js/core/sanitize.js
// ============================================
// Escapes user-controlled text before it's interpolated into innerHTML.
// Any text a user can type — message body, product/room name, delivery
// address, profile name — must go through this before being inserted into
// a template string that gets assigned to .innerHTML. Without it, a user
// could type something like <img src=x onerror="steal-session-code-here">
// and have it execute in ANOTHER user's browser the moment they view it.
// ============================================

const ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

if (typeof window !== "undefined") {
  window.escapeHtml = escapeHtml;
}
