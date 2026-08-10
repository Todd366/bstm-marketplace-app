// js/pages/seller-dashboard.js
import { supabase } from "../core/supabase-client.js";

function renderProducts(products) {
  const container = document.getElementById("my-products-list");
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML =
      '<p style="color:#9CA3AF;font-size:14px;">You haven\'t listed any products yet. ' +
      '<a href="upload-product.html" style="color:#7C3AED;font-weight:700;">List your first one →</a></p>';
    return;
  }

  container.innerHTML = products
    .map(
      (p) => `
    <div style="background:#fff;border:1.5px solid #EDE9FE;border-radius:16px;padding:16px;display:flex;align-items:center;gap:14px;">
      <div style="width:56px;height:56px;border-radius:10px;background:#F5F3FF;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
        ${p.image ? `<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;">` : '<span style="font-size:24px;">📦</span>'}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:800;color:#1E1B4B;font-size:14px;">${p.name}</div>
        <div style="font-size:12px;color:#9CA3AF;">Qty: ${p.quantity ?? "—"} · ${p.status}</div>
      </div>
      <div style="font-weight:900;color:#7C3AED;font-size:15px;">P${Number(p.price).toFixed(2)}</div>
    </div>`
    )
    .join("");
}

window.BSTM.ready().then(async function (session) {
  const wall = document.getElementById("auth-wall");
  const content = document.getElementById("seller-content");

  if (!session) {
    if (wall) wall.style.display = "flex";
    if (content) content.style.display = "none";
    return;
  }

  if (wall) wall.style.display = "none";
  if (content) content.style.display = "block";

  const nameEl = document.getElementById("seller-name");
  if (nameEl) {
    nameEl.textContent =
      session.user.user_metadata?.full_name || session.user.email.split("@")[0];
  }

  const userId = session.user.id;

  // Room status — controls whether "Open Your Room" CTA or "My Room" card shows
  const { data: myRoom } = await supabase
    .from("rooms")
    .select("id, room_number, name, banner_emoji")
    .eq("seller_id", userId)
    .maybeSingle();

  if (myRoom) {
    document.getElementById("open-room-cta").style.display = "none";
    document.getElementById("my-room-card").style.display = "block";
    document.getElementById("my-room-emoji").textContent = myRoom.banner_emoji || "🏪";
    document.getElementById("my-room-number").textContent = `ROOM ${myRoom.room_number}`;
    document.getElementById("my-room-name").textContent = myRoom.name;
    document.getElementById("my-room-link").href = `room.html?id=${myRoom.id}`;
  }

  // My products
  const { data: products, error: productsErr } = await supabase
    .from("products")
    .select("id, name, price, image, quantity, status")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });

  if (productsErr) {
    console.error("[BSTM Seller] Failed to load products:", productsErr);
  }

  const myProducts = products || [];
  renderProducts(myProducts);

  const statProducts = document.getElementById("stat-products");
  if (statProducts) statProducts.textContent = myProducts.length;

  // Revenue + order count — sum order_items for this seller's products
  const productIds = myProducts.map((p) => p.id);
  let revenue = 0;
  let orderCount = 0;

  if (productIds.length > 0) {
    const { data: items, error: itemsErr } = await supabase
      .from("order_items")
      .select("order_id, quantity, unit_price")
      .in("product_id", productIds);

    if (itemsErr) {
      console.error("[BSTM Seller] Failed to load order items:", itemsErr);
    } else if (items) {
      revenue = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
      orderCount = new Set(items.map((i) => i.order_id)).size;
    }
  }

  const statRevenue = document.getElementById("stat-revenue");
  if (statRevenue) statRevenue.textContent = `P${revenue.toFixed(2)}`;

  const statOrders = document.getElementById("stat-orders");
  if (statOrders) statOrders.textContent = orderCount;

  // THB balance — sum wallet_ledger for this user
  const { data: ledger, error: ledgerErr } = await supabase
    .from("wallet_ledger")
    .select("amount_thb, type")
    .eq("user_id", userId);

  if (ledgerErr) {
    console.error("[BSTM Seller] Failed to load wallet ledger:", ledgerErr);
  }

  const thbBalance = (ledger || []).reduce(
    (sum, entry) => sum + (entry.type === "credit" ? entry.amount_thb : -entry.amount_thb),
    0
  );

  const thbEl = document.getElementById("seller-thb");
  if (thbEl) thbEl.textContent = thbBalance.toFixed(1);
});

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
