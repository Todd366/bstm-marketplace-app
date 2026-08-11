// js/pages/marketplace.js
import { supabase } from "../core/supabase-client.js";
import { getRoomTemplate } from "../core/room-templates.js";

const CATEGORY_MAP = {
  food: ["fresh-produce", "agriculture"],
  tech: ["electronics"],
  fashion: ["fashion"],
  transport: ["vehicles"],
  services: ["services", "home"],
  art: [], // no rooms in this category yet — honestly shows empty, not faked
};

let allRooms = [];
let currentCategory = "all";
let currentSearch = "";

function renderRooms() {
  const grid = document.getElementById("rooms-grid");
  const noResults = document.getElementById("no-results");
  const countEl = document.getElementById("room-count");

  let filtered = allRooms;

  if (currentCategory === "open") {
    // all fetched rooms are already status=active; kept as an explicit,
    // honest filter rather than silently treating it as a no-op
    filtered = filtered.filter((r) => r.status === "active");
  } else if (currentCategory === "coming") {
    filtered = []; // no "coming soon" rooms exist yet — show real empty state
  } else if (currentCategory !== "all") {
    const cats = CATEGORY_MAP[currentCategory] || [];
    filtered = filtered.filter((r) => cats.includes(r.category));
  }

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q)
    );
  }

  countEl.textContent = `${filtered.length} of ${allRooms.length} rooms`;

  if (filtered.length === 0) {
    grid.innerHTML = "";
    noResults.style.display = "block";
    return;
  }
  noResults.style.display = "none";

  grid.innerHTML = filtered
    .map((r) => {
      const tpl = getRoomTemplate(r.category);
      return `
    <div class="room-card" onclick="window.location.href='room.html?id=${r.id}'"
         style="background:#fff;border-radius:20px;overflow:hidden;border:1.5px solid #EDE9FE;cursor:pointer;">
      <div style="height:120px;background:${tpl.bannerBg};display:flex;align-items:center;justify-content:center;">
        <span style="font-size:48px;">${r.banner_emoji || "🏪"}</span>
      </div>
      <div style="padding:16px;">
        <div style="font-size:11px;color:#9CA3AF;font-weight:700;margin-bottom:4px;">ROOM ${r.room_number} · ${tpl.label.toUpperCase()}</div>
        <div style="font-weight:900;color:#1E1B4B;font-size:16px;margin-bottom:6px;font-family:${tpl.font};">${r.name}</div>
        <div style="font-size:12px;color:#9CA3AF;margin-bottom:10px;">${r.productCount} product${r.productCount === 1 ? "" : "s"}</div>
        <div style="display:block;background:${tpl.bannerBg};color:#fff;padding:10px;
                    border-radius:10px;font-weight:700;font-size:13px;text-align:center;">
          Visit Room
        </div>
      </div>
    </div>`;
    })
    .join("");
}

window.doSearch = function () {
  currentSearch = document.getElementById("search-input").value.trim();
  renderRooms();
};

document.addEventListener("DOMContentLoaded", async function () {
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") window.doSearch();
    });
  }

  document.querySelectorAll(".cat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cat-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.dataset.cat;
      renderRooms();
    });
  });

  const { data: rooms, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("status", "active")
    .order("room_number", { ascending: true });

  if (error || !rooms) {
    console.error("[BSTM Marketplace] Failed to load rooms:", error);
    return;
  }

  // Real product count per room
  const { data: productCounts } = await supabase
    .from("products")
    .select("room_id")
    .eq("status", "active");

  const countByRoom = {};
  (productCounts || []).forEach((p) => {
    if (p.room_id) countByRoom[p.room_id] = (countByRoom[p.room_id] || 0) + 1;
  });

  allRooms = rooms.map((r) => ({ ...r, productCount: countByRoom[r.id] || 0 }));
  renderRooms();
});
