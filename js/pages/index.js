// ============================================
// INDEX PAGE LOGIC
// ============================================
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";

// First visit in this browser and not signed in: the welcome page explains the workspaces before anything else.
// (welcome.html marks the browser as welcomed, so this happens once.)
(async () => {
  try {
    if (localStorage.getItem("bstm_welcomed")) return;
    const session = await window.BSTM.ready();
    if (!session) window.location.replace("welcome.html");
  } catch (e) {
    /* storage blocked or app not ready: just show the Mall */
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  console.log("[BSTM] index.js loaded");

  window.addEventListener("bstm:ready", () => {
    console.log("[BSTM] UI ready (index)");
  });

  supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .then(({ count }) => {
      const el = document.getElementById("total-rooms-stat");
      if (el && typeof count === "number") el.textContent = count;
    });

  supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .then(({ count }) => {
      const el = document.getElementById("open-rooms-stat");
      if (el && typeof count === "number") el.textContent = count;
    });

  supabase
    .from("rooms")
    .select("id, name, description, banner_emoji, banner_color")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .then(({ data: room }) => {
      if (!room) return; // honestly show nothing rather than a fake example

      const section = document.getElementById("featured-room-section");
      const heading = document.getElementById("featured-room-heading");
      const card = document.getElementById("featured-room-card");
      if (!section || !heading || !card) return;

      heading.textContent = room.name; // textContent — inherently safe
            const emoji = escapeHtml(room.banner_emoji || "🏬");
      card.innerHTML = `
        <div style="height:180px;background:var(--bstm-grad);display:flex;align-items:center;justify-content:center;font-size:70px;">
          ${emoji}
        </div>
        <div style="padding:24px;text-align:left;">
          <p style="margin:12px 0;color:#666;">${escapeHtml(room.description || "Visit this room in the mall.")}</p>
          <span style="font-weight:700;color:#00708E;">Enter Room →</span>
        </div>`;
      card.addEventListener("click", () => {
        window.location.href = `room.html?id=${room.id}`;
      });
      section.classList.remove("hidden");
    });
});
