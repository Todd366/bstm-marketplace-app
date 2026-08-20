// js/pages/room.js
import { supabase } from "../core/supabase-client.js";
import { getRoomTemplate } from "../core/room-templates.js";
import { escapeHtml } from "../core/sanitize.js";

function renderCard(p, tpl) {
  const img = p.image
    ? `<img src="${escapeHtml(p.image)}" style="width:100%;height:100%;object-fit:cover;">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;">📦</div>`;

  if (tpl.cardStyle === "market") {
    return `
      <a href="product-detail.html?id=${p.id}" style="display:block;background:#fff;border:2px solid #D9C9A3;border-radius:10px;overflow:hidden;text-decoration:none;">
        <div style="aspect-ratio:1;background:#F3EEE0;">${img}</div>
        <div style="padding:10px;font-family:${tpl.font};">
          <div style="font-weight:700;color:#292524;font-size:13px;">${escapeHtml(p.name)}</div>
          <div style="color:${tpl.accent};font-weight:900;margin-top:4px;">P${Number(p.price).toFixed(2)}</div>
        </div>
      </a>`;
  }

  if (tpl.cardStyle === "tech") {
    return `
      <a href="product-detail.html?id=${p.id}" style="display:block;background:#1E293B;border:1px solid #334155;border-radius:8px;overflow:hidden;text-decoration:none;">
        <div style="aspect-ratio:1;background:#0F172A;">${img}</div>
        <div style="padding:10px;font-family:${tpl.font};">
          <div style="font-weight:600;color:#E2E8F0;font-size:12px;">${escapeHtml(p.name)}</div>
          <div style="color:${tpl.accent};font-weight:900;margin-top:6px;font-size:14px;">P${Number(p.price).toFixed(2)}</div>
        </div>
      </a>`;
  }

  if (tpl.cardStyle === "boutique") {
    return `
      <a href="product-detail.html?id=${p.id}" style="display:block;text-decoration:none;">
        <div style="aspect-ratio:3/4;background:#F5E6EC;border-radius:2px;overflow:hidden;">${img}</div>
        <div style="padding:12px 4px;font-family:${tpl.font};text-align:center;">
          <div style="color:#57534E;font-size:13px;letter-spacing:0.5px;">${escapeHtml(p.name)}</div>
          <div style="color:${tpl.accent};font-weight:700;margin-top:4px;">P${Number(p.price).toFixed(2)}</div>
        </div>
      </a>`;
  }

  if (tpl.cardStyle === "showroom") {
    return `
      <a href="product-detail.html?id=${p.id}" style="display:block;background:#1F2937;border-radius:14px;overflow:hidden;text-decoration:none;">
        <div style="aspect-ratio:16/9;background:#111827;">${img}</div>
        <div style="padding:16px;">
          <div style="color:#F3F4F6;font-weight:700;font-size:15px;">${escapeHtml(p.name)}</div>
          <div style="color:${tpl.accent};font-weight:900;margin-top:6px;font-size:18px;">P${Number(p.price).toFixed(2)}</div>
        </div>
      </a>`;
  }

  if (tpl.cardStyle === "service-list") {
    return `
      <a href="product-detail.html?id=${p.id}" style="display:flex;align-items:center;gap:16px;background:#fff;border-radius:12px;padding:16px;text-decoration:none;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <div style="width:64px;height:64px;border-radius:10px;overflow:hidden;flex-shrink:0;background:#EFF6FF;">${img}</div>
        <div style="flex:1;">
          <div style="color:#1F2937;font-weight:700;">${escapeHtml(p.name)}</div>
        </div>
        <div style="color:${tpl.accent};font-weight:900;">P${Number(p.price).toFixed(2)}</div>
      </a>`;
  }

  // catalog (default / home)
  return `
    <a href="product-detail.html?id=${p.id}" style="display:block;background:#fff;border-radius:14px;overflow:hidden;text-decoration:none;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
      <div style="aspect-ratio:1;background:#F3F4F6;">${img}</div>
      <div style="padding:12px;">
        <div style="color:#374151;font-weight:700;font-size:13px;">${escapeHtml(p.name)}</div>
        <div style="color:${tpl.accent};font-weight:900;margin-top:4px;">P${Number(p.price).toFixed(2)}</div>
      </div>
    </a>`;
}

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

  const tpl = getRoomTemplate(room.category);

  document.title = `${room.name} — BSTM Mall`;
  document.body.style.background = tpl.bodyBg;
  if (tpl.dark) document.body.classList.add("dark-room");

  document.getElementById("room-content").classList.remove("hidden");
  document.getElementById("room-banner").style.background = tpl.bannerBg;
  document.getElementById("room-emoji").textContent = room.banner_emoji || "🏪";
  document.getElementById("room-number-label").textContent = `ROOM ${room.room_number} · ${tpl.tagline}`;
  document.getElementById("room-name").textContent = room.name;
  document.getElementById("room-name").style.fontFamily = tpl.font;
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
  grid.className = `grid ${tpl.cardGrid} gap-5`;

  if (!products || products.length === 0) {
    grid.innerHTML = `<p style="color:${tpl.dark ? "#9CA3AF" : "#9CA3AF"};font-size:14px;grid-column:1/-1;">No products yet.</p>`;
  } else {
    grid.innerHTML = products.map((p) => renderCard(p, tpl)).join("");
  }

  const heading = document.getElementById("room-products-heading");
  if (heading) {
    heading.textContent = tpl.cardStyle === "service-list" ? "Services Offered" : "Products";
    heading.style.color = tpl.dark ? "#F3F4F6" : "#1F2937";
    heading.style.fontFamily = tpl.font;
  }

  const session = await window.BSTM.ready();
  if (session && session.user.id === room.seller_id) {
    document.getElementById("room-owner-actions").classList.remove("hidden");
  }
});
