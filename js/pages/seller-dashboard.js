// js/pages/seller-dashboard.js
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";
import { requireSellerAccess } from "../bstm-core.js?v=1792108428";
import { loadMyRooms, pickRoom, roomIdFromUrl } from "../core/my-rooms.js";

let productLookup = new Map();

// Room switcher + shortcuts for the selected room. Several rooms under one
// owner (e.g. a tuckshop, a café and a car wash) are switched with ?room=<id>.
function renderRoomTools(room, rooms) {
  const card = document.getElementById("my-room-card");
  if (!card || document.getElementById("room-tools")) return;

  const tools = document.createElement("div");
  tools.id = "room-tools";
  tools.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;";

  const chip = (href, text, active) => {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = text;
    a.style.cssText =
      "padding:8px 14px;border-radius:10px;font-weight:700;font-size:12px;text-decoration:none;border:1.5px solid " +
      (active ? "#7C3AED;background:#7C3AED;color:#fff;" : "#DDD6FE;background:#F5F3FF;color:#7C3AED;");
    return a;
  };

  if (rooms.length > 1) {
    rooms.forEach((r) => {
      tools.appendChild(chip(`seller-dashboard.html?room=${encodeURIComponent(r.id)}`, `Room ${r.room_number} · ${r.name}`, r.id === room.id));
    });
    const sep = document.createElement("div");
    sep.style.cssText = "flex-basis:100%;height:0;";
    tools.appendChild(sep);
  }

  const rid = encodeURIComponent(room.id);
  tools.appendChild(chip(`counter.html?room=${rid}`, "🧮 Open the till", false));
  tools.appendChild(chip("daily-sheet.html", "📒 Daily sheet", false));
  tools.appendChild(chip(`upload-product.html?room=${rid}`, "📤 Add product", false));
  if (rooms.some((r) => r.isOwner)) tools.appendChild(chip("open-room.html", "➕ Open another room", false));

  card.appendChild(tools);
}

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

  // Real gate: a plain buyer with no seller role and no room-staff
  // membership shouldn't land on this page at all — this used to only
  // check login, so any logged-in buyer could reach the seller shell
  // by URL. Staff members (added via add_room_employee) keep access
  // even though their base profiles.role stays "buyer".
  const gate = await requireSellerAccess();
  if (!gate) return;

  if (wall) wall.style.display = "none";
  if (content) content.style.display = "block";

  const nameEl = document.getElementById("seller-name");
  if (nameEl) {
    nameEl.textContent =
      session.user.user_metadata?.full_name || session.user.email.split("@")[0];
  }

  const userId = session.user.id;

  // Room status — controls whether "Open Your Room" CTA or "My Room" card shows.
  // Checks both ownership AND staff membership (room_roles) — an employee
  // added via Room Staff needs to actually see the room they work in, not
  // just the literal owner.
  const { rooms: myRooms } = await loadMyRooms(userId);
  const myRoom = pickRoom(myRooms, roomIdFromUrl());
  const isOwner = !!myRoom && myRoom.isOwner;

  if (myRoom) {
    document.getElementById("open-room-cta").style.display = "none";
    document.getElementById("my-room-card").style.display = "block";
    document.getElementById("my-room-emoji").textContent = myRoom.banner_emoji || "🏪";
    document.getElementById("my-room-number").textContent = `ROOM ${myRoom.room_number}`;
    document.getElementById("my-room-name").textContent = myRoom.name;
    document.getElementById("my-room-link").href = `room.html?id=${myRoom.id}`;
    renderRoomTools(myRoom, myRooms);
    // Only the actual owner manages staff — an employee shouldn't add more staff.
    const staffSection = document.getElementById("room-staff-section");
    if (isOwner) {
      loadRoomStaff(myRoom.id);
    } else if (staffSection) {
      staffSection.style.display = "none";
    }

    // Business info — owner-only, shown to shoppers on the public room page.
    const infoSection = document.getElementById("room-info-section");
    if (isOwner) {
      loadRoomInfo(myRoom.id);
    } else if (infoSection) {
      infoSection.style.display = "none";
    }
  }

  // My products
  // An owner sees the products of the room selected above (one owner can run
  // several rooms); everyone else keeps the old per-seller list.
  let productsQuery = supabase
    .from("products")
    .select("id, name, price, image, quantity, status, description")
    .eq("seller_id", userId);
  if (isOwner) productsQuery = productsQuery.eq("room_id", myRoom.id);
  const { data: products, error: productsErr } = await productsQuery.order("created_at", { ascending: false });

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

  loadSellerOrders(session.user.id, isOwner ? myRoom.id : null);
});

const STATUS_NEXT = {
  pending: { label: "Confirm Order", next: "confirmed" },
  confirmed: { label: "Mark Shipped", next: "shipped" },
  shipped: { label: "Mark Delivered", next: "delivered" },
};

async function loadSellerOrders(sellerId, roomId = null) {
  const listEl = document.getElementById("seller-orders-list");
  if (!listEl) return;

  // Figure out which product_ids this person is actually allowed to
  // fulfill: their own products, plus products in any room they're
  // staff of. Matches the room_roles-aware RLS policy — without this,
  // a staff member's orders would never show up even though they're
  // technically allowed to see them.
  const { data: staffRooms } = await supabase
    .from("room_roles")
    .select("room_id")
    .eq("user_id", sellerId)
    .in("role_id", ["ROOM_MANAGER", "EMPLOYEE"]);

  const roomIds = (staffRooms || []).map((r) => r.room_id);

  let productQuery = supabase.from("products").select("id");
  if (roomId) {
    // An owner looking at one of their rooms sees only that room's orders.
    productQuery = productQuery.eq("room_id", roomId);
  } else if (roomIds.length > 0) {
    productQuery = productQuery.or(`seller_id.eq.${sellerId},room_id.in.(${roomIds.join(",")})`);
  } else {
    productQuery = productQuery.eq("seller_id", sellerId);
  }
  const { data: myProducts } = await productQuery;
  const productIds = (myProducts || []).map((p) => p.id);

  if (productIds.length === 0) {
    listEl.innerHTML = '<p class="text-gray-400 text-sm">No orders yet.</p>';
    return;
  }

  const { data: items, error } = await supabase
    .from("order_items")
    .select("order_id, quantity, unit_price, product_id, products(name), orders(id, status, delivery_name, delivery_address, delivery_city, created_at)")
    .in("product_id", productIds)
    .order("order_id", { ascending: false });

  if (error) {
    console.error("[BSTM Seller] Failed to load orders:", error);
    listEl.innerHTML = '<p class="text-red-500 text-sm">Couldn\'t load orders.</p>';
    return;
  }

  const rows = (items || []).filter((i) => i.orders);
  if (rows.length === 0) {
    listEl.innerHTML = '<p class="text-gray-400 text-sm">No orders yet.</p>';
    return;
  }

  // group line items by order
  const byOrder = {};
  for (const row of rows) {
    const oid = row.orders.id;
    if (!byOrder[oid]) byOrder[oid] = { order: row.orders, lines: [] };
    byOrder[oid].lines.push(row);
  }

  listEl.innerHTML = Object.values(byOrder)
    .map(({ order, lines }) => {
      const action = STATUS_NEXT[order.status];
      const itemsHtml = lines
        .map((l) => `<li>${escapeHtml(l.products?.name || "Item")} × ${l.quantity} — P${(l.unit_price * l.quantity).toFixed(2)}</li>`)
        .join("");
      const btnHtml = action
        ? `<button data-order-id="${order.id}" data-next-status="${action.next}" class="seller-advance-btn bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">${action.label}</button>`
        : order.status === "cancelled"
        ? '<span class="text-red-500 text-sm font-semibold">Cancelled</span>'
        : '<span class="text-green-600 text-sm font-semibold">Delivered</span>';

      return `
        <div class="border-2 border-gray-100 rounded-xl p-5 mb-4">
          <div class="flex justify-between items-start mb-2">
            <div>
              <p class="font-bold text-gray-800">${escapeHtml(order.delivery_name || "Buyer")}</p>
              <p class="text-sm text-gray-500">${escapeHtml(order.delivery_address || "")}, ${escapeHtml(order.delivery_city || "")}</p>
            </div>
            <span class="text-xs uppercase font-semibold text-gray-400">${escapeHtml(order.status)}</span>
          </div>
          <ul class="text-sm text-gray-600 list-disc list-inside mb-3">${itemsHtml}</ul>
          ${btnHtml}
        </div>`;
    })
    .join("");

  document.querySelectorAll(".seller-advance-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const orderId = btn.dataset.orderId;
      const nextStatus = btn.dataset.nextStatus;
      const { error } = await supabase.rpc("advance_order_status", {
        p_order_id: orderId,
        p_new_status: nextStatus,
      });
      if (error) {
        console.error("[BSTM Seller] Couldn't advance order:", error);
        alert("Couldn't update this order. Please try again.");
        btn.disabled = false;
        return;
      }
      loadSellerOrders(sellerId, roomId);
    });
  });
}

async function loadRoomInfo(roomId) {
  const { data: room, error } = await supabase
    .from("rooms")
    .select("contact_phone, contact_email, address, business_hours, policies")
    .eq("id", roomId)
    .single();

  if (error || !room) {
    console.error("[BSTM Seller] Failed to load room info:", error);
    return;
  }

  document.getElementById("room-info-phone").value = room.contact_phone || "";
  document.getElementById("room-info-email").value = room.contact_email || "";
  document.getElementById("room-info-address").value = room.address || "";
  document.getElementById("room-info-hours").value = room.business_hours || "";
  document.getElementById("room-info-policies").value = room.policies || "";

  const saveBtn = document.getElementById("room-info-save-btn");
  const statusEl = document.getElementById("room-info-status");
  if (!saveBtn) return;

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    const updates = {
      contact_phone: document.getElementById("room-info-phone").value.trim() || null,
      contact_email: document.getElementById("room-info-email").value.trim() || null,
      address: document.getElementById("room-info-address").value.trim() || null,
      business_hours: document.getElementById("room-info-hours").value.trim() || null,
      policies: document.getElementById("room-info-policies").value.trim() || null,
    };
    const { error: saveError } = await supabase.from("rooms").update(updates).eq("id", roomId);
    saveBtn.disabled = false;

    if (statusEl) {
      statusEl.classList.remove("hidden");
      if (saveError) {
        console.error("[BSTM Seller] Failed to save room info:", saveError);
        statusEl.textContent = "Couldn't save — please try again.";
        statusEl.style.color = "#DC2626";
      } else {
        statusEl.textContent = "Saved ✓";
        statusEl.style.color = "#166534";
        setTimeout(() => statusEl.classList.add("hidden"), 3000);
      }
    }
  });
}

async function loadRoomStaff(roomId) {
  const listEl = document.getElementById("room-staff-list");
  if (!listEl) return;

  const { data: staff, error } = await supabase
    .from("room_roles")
    .select("id, role_id, user_id, profiles!room_roles_user_id_profiles_fkey(email)")
    .eq("room_id", roomId);

  if (error) {
    console.error("[BSTM Seller] Failed to load room staff:", error);
    listEl.innerHTML = '<p class="text-sm text-gray-400">Couldn\'t load staff.</p>';
    return;
  }

  if (!staff || staff.length === 0) {
    listEl.innerHTML = '<p class="text-sm text-gray-400">No staff added yet.</p>';
  } else {
    listEl.innerHTML = staff
      .map(
        (s) => `
      <div class="flex justify-between items-center gap-2 py-2 border-b border-gray-100 last:border-0">
        <span class="text-sm text-gray-700">${escapeHtml(s.profiles?.email || "Unknown")}</span>
        <span class="flex items-center gap-3">
          <span class="text-xs font-semibold text-purple-600">${escapeHtml(s.role_id)}</span>
          ${
            s.role_id === "ROOM_OWNER"
              ? ""
              : `<button type="button" data-remove-staff="${escapeHtml(s.id)}" class="text-xs font-bold text-red-600 hover:text-red-800">Remove</button>`
          }
        </span>
      </div>`
      )
      .join("");

    if (!listEl.dataset.removeBound) {
      listEl.dataset.removeBound = "true";
      listEl.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-remove-staff]");
        if (!btn) return;
        if (!window.confirm("Remove this person's access to the room?")) return;
        btn.disabled = true;
        const { error: delErr } = await supabase.from("room_roles").delete().eq("id", btn.dataset.removeStaff);
        if (delErr) {
          console.error("[BSTM Seller] Couldn't remove staff:", delErr);
          window.alert("Couldn't remove this person: " + (delErr.message || "unknown error"));
          btn.disabled = false;
          return;
        }
        loadRoomStaff(roomId);
      });
    }
  }

  const form = document.getElementById("add-staff-form");
  if (form && !form.dataset.bound) {
    form.dataset.bound = "true";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById("staff-email");
      const roleInput = document.getElementById("staff-role");
      const errEl = document.getElementById("staff-error");
      if (errEl) errEl.classList.add("hidden");

      const { error: addErr } = await supabase.rpc("add_room_employee", {
        p_room_id: roomId,
        p_employee_email: emailInput.value.trim(),
        p_role_id: roleInput.value,
      });

      if (addErr) {
        console.error("[BSTM Seller] Couldn't add staff:", addErr);
        if (errEl) {
          errEl.textContent = addErr.message || "Couldn't add this person.";
          errEl.classList.remove("hidden");
        }
        return;
      }

      emailInput.value = "";
      loadRoomStaff(roomId);
    });
  }
}

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
