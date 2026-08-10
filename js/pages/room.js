// js/pages/room.js
import { supabase } from "../core/supabase-client.js";

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("id");

  if (!roomId) {
    document.getElementById("room-not-found").classList.remove("hidden");
    return;
  }

  const { data: room, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .eq("status", "active")
    .single();

  if (error || !room) {
    document.getElementById("room-not-found").classList.remove("hidden");
    return;
  }

  document.title = `${room.name} — BSTM Mall`;
  document.getElementById("room-content").classList.remove("hidden");
  document.getElementById("room-banner").style.background = room.banner_color || "#7C3AED";
  document.getElementById("room-emoji").textContent = room.banner_emoji || "🏪";
  document.getElementById("room-number-label").textContent = `ROOM ${room.room_number}`;
  document.getElementById("room-name").textContent = room.name;
  document.getElementById("room-description").textContent = room.description || "";

  if (params.get("welcome") === "1") {
    document.getElementById("welcome-banner").classList.remove("hidden");
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, image, status")
    .eq("room_id", roomId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const grid = document.getElementById("room-products");
  if (!products || products.length === 0) {
    grid.innerHTML = '<p class="text-gray-400 text-sm col-span-full">No products yet.</p>';
  } else {
    grid.innerHTML = products
      .map(
        (p) => `
      <a href="product-detail.html?id=${p.id}" class="bg-white rounded-xl shadow hover:shadow-lg transition-all overflow-hidden block">
        <div class="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
          ${p.image ? `<img src="${p.image}" class="w-full h-full object-cover">` : '<span class="text-4xl">📦</span>'}
        </div>
        <div class="p-3">
          <p class="font-semibold text-gray-800 text-sm truncate">${p.name}</p>
          <p class="text-purple-600 font-bold">P${Number(p.price).toFixed(2)}</p>
        </div>
      </a>`
      )
      .join("");
  }

  const session = await window.BSTM.ready();
  if (session && session.user.id === room.seller_id) {
    document.getElementById("room-owner-actions").classList.remove("hidden");
  }
});
