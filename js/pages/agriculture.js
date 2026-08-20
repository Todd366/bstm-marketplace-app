// js/pages/agriculture.js
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";

const SECTOR_CATEGORIES = ["agriculture", "fresh-produce"];

document.addEventListener("DOMContentLoaded", async function () {
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, description, banner_emoji, banner_color, category")
    .in("category", SECTOR_CATEGORIES)
    .eq("status", "active")
    .order("room_number");

  const roomsGrid = document.getElementById("sector-rooms-grid");
  const emptyState = document.getElementById("sector-empty-state");
  const roomsSection = document.getElementById("sector-rooms-section");
  const productsSection = document.getElementById("sector-products-section");
  const productsGrid = document.getElementById("sector-products-grid");

  if (!rooms || rooms.length === 0) {
    roomsSection.classList.add("hidden");
    emptyState.classList.remove("hidden");
    return;
  }

  roomsGrid.innerHTML = rooms
    .map(
      (r) => `
    <a href="room.html?id=${r.id}" style="background:#fff;border-radius:18px;overflow:hidden;
       border:1.5px solid #A7F3D0;text-decoration:none;display:block;transition:box-shadow 0.2s;">
      <div style="height:110px;background:${escapeHtml(r.banner_color || "#059669")};
           display:flex;align-items:center;justify-content:center;font-size:40px;">
        ${escapeHtml(r.banner_emoji || "🌾")}
      </div>
      <div style="padding:14px;">
        <div style="font-weight:800;color:#1E1B4B;font-size:14px;">${escapeHtml(r.name)}</div>
        <div style="font-size:12px;color:#6B7280;margin-top:4px;">${escapeHtml(r.description || "")}</div>
      </div>
    </a>`
    )
    .join("");

  // Pull real products from these rooms — no filler, none shown if empty.
  const roomIds = rooms.map((r) => r.id);
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, image, quantity")
    .in("room_id", roomIds)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(24);

  if (products && products.length > 0) {
    productsGrid.innerHTML = products
      .map(
        (p) => `
      <a href="product-detail.html?id=${p.id}" style="background:#fff;border-radius:16px;overflow:hidden;
         border:1px solid #E5E7EB;text-decoration:none;display:block;">
        ${
          p.image
            ? `<img src="${escapeHtml(p.image)}" style="width:100%;height:140px;object-fit:cover;" onerror="this.style.display='none'">`
            : `<div style="height:140px;background:#ECFDF5;display:flex;align-items:center;justify-content:center;font-size:36px;">🌾</div>`
        }
        <div style="padding:12px;">
          <div style="font-weight:700;color:#1E1B4B;font-size:13px;">${escapeHtml(p.name)}</div>
          <div style="font-weight:900;color:#059669;font-size:15px;margin-top:4px;">P${Number(p.price || 0).toFixed(2)}</div>
          ${p.quantity <= 0 ? '<div style="font-size:11px;color:#DC2626;font-weight:700;margin-top:2px;">Out of stock</div>' : ""}
        </div>
      </a>`
      )
      .join("");
    productsSection.classList.remove("hidden");
  }
});
