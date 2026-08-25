// js/pages/seller-dashboard.js
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";

let productLookup = new Map();

function renderProducts(products) {
  const container = document.getElementById("my-products-list");
  if (!container) return;

  productLookup = new Map(products.map((p) => [p.id, p]));

  if (products.length === 0) {
    container.innerHTML =
      '<p style="color:#9CA3AF;font-size:14px;">You haven\'t listed any products yet. ' +
      '<a href="upload-product.html" style="color:#7C3AED;font-weight:700;">List your first one →</a></p>';
    return;
  }

  container.innerHTML = products
    .map((p) => {
      const isActive = p.status === "active";
      return `
    <div style="background:#fff;border:1.5px solid #EDE9FE;border-radius:16px;padding:16px;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
        <div style="width:56px;height:56px;border-radius:10px;background:#F5F3FF;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
          ${p.image ? `<img src="${escapeHtml(p.image)}" style="width:100%;height:100%;object-fit:cover;">` : '<span style="font-size:24px;">📦</span>'}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:800;color:#1E1B4B;font-size:14px;">${escapeHtml(p.name)}</div>
          <div style="font-size:12px;color:${isActive ? "#9CA3AF" : "#DC2626"};">Qty: ${p.quantity ?? "—"} · ${p.status}</div>
        </div>
        <div style="font-weight:900;color:#7C3AED;font-size:15px;">P${Number(p.price).toFixed(2)}</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="openEditModal('${p.id}')" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid #DDD6FE;background:#F5F3FF;color:#7C3AED;font-weight:700;font-size:12px;">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button onclick="toggleProductStatus('${p.id}', '${p.status}')" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid ${isActive ? "#FECACA" : "#BBF7D0"};background:${isActive ? "#FEF2F2" : "#F0FDF4"};color:${isActive ? "#DC2626" : "#16A34A"};font-weight:700;font-size:12px;">
          <i class="fas fa-${isActive ? "eye-slash" : "eye"}"></i> ${isActive ? "Deactivate" : "Reactivate"}
        </button>
      </div>
    </div>`;
    })
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
    .select("id, name, price, image, quantity, status, description")
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

// ---------- Edit / Deactivate ----------

window.openEditModal = function (productId) {
  const p = productLookup.get(productId);
  if (!p) return;

  document.getElementById("edit-product-id").value = p.id;
  document.getElementById("edit-product-name").value = p.name || "";
  document.getElementById("edit-product-price").value = p.price;
  document.getElementById("edit-product-quantity").value = p.quantity ?? 0;
  document.getElementById("edit-product-description").value = p.description || "";
  document.getElementById("edit-product-error").style.display = "none";
  document.getElementById("edit-product-modal").style.display = "flex";
};

window.closeEditModal = function () {
  document.getElementById("edit-product-modal").style.display = "none";
};

window.saveProductEdit = async function () {
  const errEl = document.getElementById("edit-product-error");
  errEl.style.display = "none";

  const id = document.getElementById("edit-product-id").value;
  const name = document.getElementById("edit-product-name").value.trim();
  const price = parseFloat(document.getElementById("edit-product-price").value);
  const quantity = parseInt(document.getElementById("edit-product-quantity").value, 10);
  const description = document.getElementById("edit-product-description").value.trim();

  if (!name || !(price > 0) || !(quantity >= 0)) {
    errEl.textContent = "Please fill in a valid name, price, and quantity.";
    errEl.style.display = "block";
    return;
  }

  const btn = document.getElementById("edit-product-save-btn");
  btn.disabled = true;
  btn.textContent = "Saving…";

  const { error } = await supabase
    .from("products")
    .update({ name, price, quantity, description })
    .eq("id", id);

  btn.disabled = false;
  btn.textContent = "Save";

  if (error) {
    console.error("[BSTM Seller] Product update failed:", error);
    errEl.textContent = "Couldn't save changes. Please try again.";
    errEl.style.display = "block";
    return;
  }

  closeEditModal();
  location.reload();
};

// "Delete" is intentionally a status change, not a real row deletion —
// products with existing orders can't be hard-deleted (order_items
// references them with no cascade), and hard-deleting would silently wipe
// any real reviews on the product (reviews cascade on product delete).
// Deactivating is safe and reversible: marketplace/room listings already
// filter on status=active, and product-detail.js now also checks status
// directly so a deactivated product can't be reached via a stale link either.
window.toggleProductStatus = async function (productId, currentStatus) {
  const newStatus = currentStatus === "active" ? "inactive" : "active";
  const verb = newStatus === "inactive" ? "deactivate" : "reactivate";

  if (!confirm(`Are you sure you want to ${verb} this product?`)) return;

  const { error } = await supabase
    .from("products")
    .update({ status: newStatus })
    .eq("id", productId);

  if (error) {
    console.error("[BSTM Seller] Status toggle failed:", error);
    alert("Couldn't update the product. Please try again.");
    return;
  }

  location.reload();
};
