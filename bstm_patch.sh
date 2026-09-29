#!/data/data/com.termux/files/usr/bin/bash
set -e
cd .

echo "Patching 5 files: buy-now stock guard, order tracking list view, THB reward sync + per-order attribution, CI secrets-check fix..."

mkdir -p "$(dirname "js/pages/product-detail.js")"
cat > js/pages/product-detail.js << 'BSTM_PATCH_EOF'
// js/pages/product-detail.js
import { supabase } from "../core/supabase-client.js";
import { addToCart } from "../core/cart.js";
import { addToWishlist, removeFromWishlist } from "../bstm-core.js";
import { escapeHtml } from "../core/sanitize.js";
import { CONFIG } from "../core/config.js";
import { logEvent } from "../core/events.js";

document.addEventListener("DOMContentLoaded", async function () {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  const { data: p, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !p) {
    const main = document.querySelector("main") || document.body;
    main.innerHTML =
      '<div style="text-align:center;padding:80px 20px;">' +
      '<div style="font-size:56px;margin-bottom:16px;">😕</div>' +
      '<p style="color:#9CA3AF;font-size:15px;margin-bottom:24px;">Product not found.</p>' +
      '<a href="marketplace.html" style="background:linear-gradient(135deg,#7C3AED,#4F46E5);' +
      'color:#fff;padding:14px 28px;border-radius:14px;font-weight:800;text-decoration:none;">Browse Mall →</a></div>';
    return;
  }

  if (p.status !== "active") {
    const main = document.querySelector("main") || document.body;
    main.innerHTML =
      '<div style="text-align:center;padding:80px 20px;">' +
      '<div style="font-size:56px;margin-bottom:16px;">🚫</div>' +
      '<p style="color:#9CA3AF;font-size:15px;margin-bottom:24px;">This product is no longer available.</p>' +
      '<a href="marketplace.html" style="background:linear-gradient(135deg,#7C3AED,#4F46E5);' +
      'color:#fff;padding:14px 28px;border-radius:14px;font-weight:800;text-decoration:none;">Browse Mall →</a></div>';
    return;
  }

  // Cart items need to know which room they came from, since each room is
  // a separate seller — checkout splits the cart into one order per room.
  let roomName = null;
  if (p.room_id) {
    const { data: roomRow } = await supabase
      .from("rooms")
      .select("name")
      .eq("id", p.room_id)
      .single();
    roomName = roomRow?.name || null;
  }

  const roomBadgeName = document.getElementById("room-badge-name");
  if (roomBadgeName) roomBadgeName.textContent = roomName || "BSTM Mall";

  const breadcrumbRoom = document.getElementById("breadcrumb-room");
  if (breadcrumbRoom) {
    breadcrumbRoom.textContent = roomName || "Mall";
    if (p.room_id) breadcrumbRoom.setAttribute("href", `room.html?id=${p.room_id}`);
  }
  const breadcrumbProduct = document.getElementById("breadcrumb-product");
  if (breadcrumbProduct) breadcrumbProduct.textContent = p.name || "Product";

  document.title = (p.name || "Product") + " — BSTM Mall";

  logEvent("product_view", {
    productId: p.id,
    roomId: p.room_id || null,
    metadata: { product_name: p.name, category: p.category, product_type: p.product_type || "physical" },
  });

  const set = function (sel, val) {
    document.querySelectorAll(sel).forEach(function (el) {
      el.textContent = val;
    });
  };

  set("#product-title", p.name || "Product");
  set("#product-price", "P" + Number(p.price || 0).toFixed(2));
  const rewardPercent = (CONFIG.MARKETPLACE?.REWARD_PERCENT ?? 1) / 100;
  set("#product-thb", "or " + (Number(p.price || 0) * rewardPercent).toFixed(2) + " THB");
  const thbBadge = document.getElementById("thb-reward-badge");
  if (thbBadge) thbBadge.textContent = (Number(p.price || 0) * rewardPercent).toFixed(1);
  set("#product-description", p.description || "No description available.");
  set("#product-category", p.category || "");

  const isService = p.product_type === "service";
  const serviceBadge = document.getElementById("service-badge");
  if (isService && serviceBadge) serviceBadge.classList.remove("hidden");

  const img = p.image || "";
  const imgEl = document.getElementById("mainImage");
  const imgFallback = document.getElementById("mainImage-fallback");
  if (img && imgEl) {
    imgEl.src = img;
    imgEl.alt = p.name || "Product";
    imgEl.style.display = "block";
    if (imgFallback) imgFallback.style.display = "none";
  }
  // else: leave the 🛍️ emoji fallback showing — no via.placeholder.com filler

  // Real "more from this room" — only shown if other products actually exist
  if (p.room_id) {
    const { data: related } = await supabase
      .from("products")
      .select("id, name, price, image")
      .eq("room_id", p.room_id)
      .eq("status", "active")
      .neq("id", p.id)
      .limit(4);

    if (related && related.length > 0) {
      const section = document.getElementById("related-products-section");
      const grid = document.getElementById("related-products-grid");
      if (section && grid) {
        section.style.display = "block";
        grid.innerHTML = related
          .map(
            (r) => `
          <a href="product-detail.html?id=${r.id}" class="bg-white rounded-2xl shadow-lg overflow-hidden block hover:shadow-xl transition-shadow">
            ${
              r.image
                ? `<img src="${escapeHtml(r.image)}" alt="${escapeHtml(r.name)}" class="w-full h-48 object-cover">`
                : `<div style="height:192px;background:#F5F3FF;display:flex;align-items:center;justify-content:center;font-size:40px;">🛍️</div>`
            }
            <div class="p-4">
              <h4 class="font-bold text-gray-800 mb-2">${escapeHtml(r.name)}</h4>
              <span class="text-xl font-bold">P${Number(r.price || 0).toFixed(2)}</span>
            </div>
          </a>`
          )
          .join("");
      }
    }
  }

  // Seller display name + verification — profiles RLS blocks a direct read
  // of another user's row, so this goes through the seller_public_info
  // view, which exposes only the two safe columns needed here.
  if (p.seller_id) {
    const { data: seller } = await supabase
      .from("seller_public_info")
      .select("display_name, is_verified")
      .eq("id", p.seller_id)
      .maybeSingle();

    set("#seller-name-display", seller?.display_name || "BSTM Seller");

    if (seller?.is_verified) {
      document.getElementById("verified-seller-row")?.classList.remove("hidden");
    }
  } else {
    set("#seller-name-display", "BSTM Marketplace");
  }

  if (p.location) {
    const locEl = document.getElementById("ships-from-location");
    const rowEl = document.getElementById("ships-from-row");
    if (locEl && rowEl) {
      locEl.textContent = p.location; // textContent — inherently safe
      rowEl.classList.remove("hidden");
    }
  }

  // Quantity selector — capped at real available stock
  const qtyInput = document.getElementById("quantity");
  const stock = Number.isFinite(p.quantity) ? p.quantity : Infinity;

  if (qtyInput) {
    qtyInput.max = stock;
    if (parseInt(qtyInput.value, 10) > stock) qtyInput.value = Math.max(1, stock);
  }

  window.increaseQty = function () {
    if (!qtyInput) return;
    const next = (parseInt(qtyInput.value, 10) || 1) + 1;
    qtyInput.value = Math.min(stock, Math.max(1, next));
  };
  window.decreaseQty = function () {
    if (!qtyInput) return;
    qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
  };

  function buildCartItem() {
    const qty = Math.min(stock, Math.max(1, parseInt(qtyInput?.value, 10) || 1));
    return {
      id: p.id,
      name: p.name,
      price: Number(p.price),
      image: p.image,
      qty,
      room_id: p.room_id || null,
      room_name: roomName,
      seller_id: p.seller_id || null,
      product_type: p.product_type || "physical",
    };
  }

  const addBtn = document.getElementById("add-to-cart-btn");
  if (addBtn) {
    if (stock <= 0) {
      addBtn.disabled = true;
      addBtn.textContent = "Out of Stock";
      addBtn.classList.add("opacity-50", "cursor-not-allowed");
    } else {
      addBtn.addEventListener("click", function () {
        window.addToCart(buildCartItem());
      });
    }
  }

  // Wishlist toggle — real add/remove against the wishlist table
  const wishBtn = document.getElementById("wishlist-btn");
  const wishIcon = document.getElementById("wishlist-icon");
  if (wishBtn) {
    wishBtn.addEventListener("click", async function () {
      const session = await window.BSTM.ready();
      if (!session) {
        window.location.href = "login.html?redirect=" + encodeURIComponent(window.location.href);
        return;
      }

      const isSaved = wishIcon.classList.contains("fas");
      if (isSaved) {
        await removeFromWishlist(session.user.id, p.id);
        wishIcon.classList.replace("fas", "far");
        wishBtn.classList.remove("text-red-500");
      } else {
        await addToWishlist(session.user.id, p.id);
        wishIcon.classList.replace("far", "fas");
        wishBtn.classList.add("text-red-500");
      }
    });

    // Reflect current saved state if already logged in
    const session = await window.BSTM.ready();
    if (session) {
      const { data: existing } = await supabase
        .from("wishlist")
        .select("product_id")
        .eq("user_id", session.user.id)
        .eq("product_id", p.id)
        .maybeSingle();
      if (existing) {
        wishIcon.classList.replace("far", "fas");
        wishBtn.classList.add("text-red-500");
      }
    }
  }

  const buyNowBtn = document.getElementById("buy-now-btn");
  if (buyNowBtn) {
    if (stock <= 0) {
      buyNowBtn.classList.add("opacity-50", "cursor-not-allowed", "pointer-events-none");
      buyNowBtn.setAttribute("aria-disabled", "true");
      buyNowBtn.textContent = "Out of Stock";
    } else {
      buyNowBtn.addEventListener("click", function (e) {
        e.preventDefault();
        addToCart(buildCartItem());
        window.location.href = "checkout.html";
      });
    }
  }

  // Message Seller — find or create a conversation for this buyer/seller/product
  const chatBtn = document.getElementById("message-seller-btn");
  if (chatBtn) {
    chatBtn.addEventListener("click", async function () {
      const session = await window.BSTM.ready();
      if (!session) {
        window.location.href = "login.html?redirect=" + encodeURIComponent(window.location.href);
        return;
      }
      if (!p.seller_id) {
        alert("This listing has no seller to message yet.");
        return;
      }
      if (session.user.id === p.seller_id) {
        alert("This is your own listing.");
        return;
      }

      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("buyer_id", session.user.id)
        .eq("seller_id", p.seller_id)
        .eq("product_id", p.id)
        .maybeSingle();

      let conversationId = existing?.id;

      if (!conversationId) {
        const { data: created, error: createErr } = await supabase
          .from("conversations")
          .insert({ buyer_id: session.user.id, seller_id: p.seller_id, product_id: p.id })
          .select()
          .single();

        if (createErr) {
          console.error("[BSTM] Failed to start conversation:", createErr);
          alert("Couldn't start a conversation right now. Please try again.");
          return;
        }
        conversationId = created.id;
      }

      window.location.href = "messages.html?conversation=" + conversationId;
    });
  }

  // ==========================================================
  // Reviews — verified-purchase only, enforced by RLS on insert
  // ==========================================================
  async function loadReviews() {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at")
      .eq("product_id", p.id)
      .order("created_at", { ascending: false });

    const summaryEl = document.getElementById("review-summary");
    const listEl = document.getElementById("reviews-list");
    if (!summaryEl || !listEl) return;

    if (!reviews || reviews.length === 0) {
      summaryEl.textContent = "No reviews yet";
      listEl.innerHTML = '<p class="text-gray-400 text-sm">Be the first to review this product.</p>';
      return;
    }

    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    summaryEl.innerHTML = `⭐ ${avg.toFixed(1)} · ${reviews.length} review${reviews.length === 1 ? "" : "s"}`;

    listEl.innerHTML = reviews
      .map(
        (r) => `
      <div class="bg-white border border-gray-100 rounded-xl p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-yellow-400">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
          <span class="text-xs text-gray-400">${new Date(r.created_at).toLocaleDateString()}</span>
        </div>
        <p class="text-sm text-gray-500 font-medium mb-1">Verified Buyer</p>
        ${r.comment ? `<p class="text-gray-700 text-sm">${escapeHtml(r.comment)}</p>` : ""}
      </div>`
      )
      .join("");
  }

  async function checkReviewEligibility(session) {
    if (!session) return;

    // Already reviewed this product?
    const { data: mine } = await supabase
      .from("reviews")
      .select("id")
      .eq("product_id", p.id)
      .eq("buyer_id", session.user.id)
      .maybeSingle();
    if (mine) return; // already reviewed — box stays hidden

    // Has a delivered order containing this product?
    const { data: eligibleOrder } = await supabase
      .from("orders")
      .select("id, order_items!inner(product_id)")
      .eq("buyer_id", session.user.id)
      .eq("status", "delivered")
      .eq("order_items.product_id", p.id)
      .limit(1)
      .maybeSingle();

    if (!eligibleOrder) return; // not a verified buyer of this product yet

    const box = document.getElementById("write-review-box");
    if (!box) return;
    box.classList.remove("hidden");

    let selectedRating = 0;
    const stars = box.querySelectorAll("#star-picker span");
    stars.forEach((star) => {
      star.addEventListener("click", () => {
        selectedRating = parseInt(star.dataset.star, 10);
        stars.forEach((s, i) => {
          s.textContent = i < selectedRating ? "★" : "☆";
        });
      });
    });

    document.getElementById("submit-review-btn").addEventListener("click", async () => {
      const errEl = document.getElementById("review-error");
      errEl.classList.add("hidden");

      if (selectedRating < 1) {
        errEl.textContent = "Please pick a star rating.";
        errEl.classList.remove("hidden");
        return;
      }

      const comment = document.getElementById("review-comment").value.trim();
      const btn = document.getElementById("submit-review-btn");
      btn.disabled = true;
      btn.textContent = "Submitting…";

      const { error } = await supabase.from("reviews").insert({
        product_id: p.id,
        order_id: eligibleOrder.id,
        buyer_id: session.user.id,
        rating: selectedRating,
        comment: comment || null,
      });

      btn.disabled = false;
      btn.textContent = "Submit Review";

      if (error) {
        console.error("[BSTM] Review submission failed:", error);
        errEl.textContent = "Couldn't submit your review. Please try again.";
        errEl.classList.remove("hidden");
        return;
      }

      box.classList.add("hidden");
      loadReviews();
    });
  }

  loadReviews();
  window.BSTM.ready().then((session) => checkReviewEligibility(session));

  // Store product in sessionStorage for legacy checkout paths that read it
  sessionStorage.setItem("checkout_product", JSON.stringify(p));
});
BSTM_PATCH_EOF

mkdir -p "$(dirname "js/pages/order-tracking.js")"
cat > js/pages/order-tracking.js << 'BSTM_PATCH_EOF'
// js/pages/order-tracking.js
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";

const STATUS_STEPS = [
  { key: "pending", label: "Order Placed", icon: "fa-check", desc: "Your order has been received." },
  { key: "confirmed", label: "Order Confirmed", icon: "fa-box", desc: "The seller is preparing your order." },
  { key: "shipped", label: "Out for Delivery", icon: "fa-truck", desc: "Your order is on its way." },
  { key: "delivered", label: "Delivered", icon: "fa-home", desc: "Delivered to your doorstep." },
];

function statusIndex(status) {
  const i = STATUS_STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

function renderTimeline(status) {
  const activeIndex = statusIndex(status);
  const container = document.getElementById("order-timeline");
  if (!container) return;

  if (status === "cancelled") {
    container.innerHTML = `
      <div class="flex items-start">
        <div class="status-dot bg-red-500 rounded-full flex items-center justify-center mr-6 flex-shrink-0">
          <i class="fas fa-times text-white text-xl"></i>
        </div>
        <div>
          <h3 class="text-lg font-bold text-gray-800">Order Cancelled</h3>
          <p class="text-sm text-gray-600 mt-2">This order was cancelled.</p>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = STATUS_STEPS.map((step, i) => {
    const isActive = i <= activeIndex;
    return `
      <div class="timeline-step ${isActive ? "active" : ""} flex items-start">
        <div class="status-dot ${isActive ? "active" : "bg-gray-300"} rounded-full flex items-center justify-center mr-6 flex-shrink-0">
          <i class="fas ${step.icon} ${isActive ? "text-white" : "text-gray-600"} text-xl"></i>
        </div>
        <div>
          <h3 class="text-lg font-bold ${isActive ? "text-gray-800" : "text-gray-400"}">${step.label}</h3>
          <p class="text-sm ${isActive ? "text-gray-500" : "text-gray-500"}">${isActive ? "" : "Pending"}</p>
          <p class="text-sm text-gray-700 mt-2">${step.desc}</p>
        </div>
      </div>`;
  }).join("");
}

function renderItems(items) {
  const container = document.getElementById("order-items-list");
  if (!container) return;

  container.innerHTML = items
    .map(
      (item) => `
      <div class="flex items-center space-x-4 p-4 border-2 border-gray-200 rounded-xl">
        <div class="flex-1">
          <h3 class="font-bold text-gray-800">${escapeHtml(item.product_name)}</h3>
          <span class="text-sm text-gray-600">Qty: ${item.quantity}</span>
        </div>
        <div class="text-right">
          <p class="text-xl font-bold text-gray-800">P${(item.unit_price * item.quantity).toFixed(2)}</p>
        </div>
      </div>`
    )
    .join("");
}

function renderOrdersList(orders) {
  const listEl = document.getElementById("orders-list");
  const emptyEl = document.getElementById("orders-list-empty");
  document.getElementById("orders-list-section").classList.remove("hidden");

  if (!orders || orders.length === 0) {
    emptyEl.classList.remove("hidden");
    return;
  }

  listEl.innerHTML = orders
    .map((o) => {
      const statusColors = {
        pending: "bg-yellow-100 text-yellow-800",
        confirmed: "bg-blue-100 text-blue-800",
        shipped: "bg-purple-100 text-purple-800",
        delivered: "bg-green-100 text-green-800",
        cancelled: "bg-red-100 text-red-800",
      };
      const colorClass = statusColors[o.status] || "bg-gray-100 text-gray-700";
      return `
      <a href="order-tracking.html?order=${o.id}" class="block bg-white rounded-xl shadow p-5 hover:shadow-md transition-shadow">
        <div class="flex justify-between items-center">
          <div>
            <p class="font-bold text-gray-800">BSTM-${o.id.split("-")[0].toUpperCase()}</p>
            <p class="text-sm text-gray-500">${new Date(o.created_at).toLocaleDateString("en-BW", { dateStyle: "medium" })}</p>
          </div>
          <div class="text-right">
            <p class="text-lg font-bold text-gray-800">P${Number(o.total_amount || 0).toFixed(2)}</p>
            <span class="inline-block text-xs font-semibold px-2 py-1 rounded-full capitalize ${colorClass}">${escapeHtml(o.status)}</span>
          </div>
        </div>
      </a>`;
    })
    .join("");
}

async function loadOrder(orderId, session) {
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("buyer_id", session.user.id)
    .single();

  if (error || !order) {
    document.getElementById("order-not-found").classList.remove("hidden");
    return;
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  document.getElementById("order-content").classList.remove("hidden");

  document.getElementById("order-number").textContent =
    "BSTM-" + order.id.split("-")[0].toUpperCase();

  document.getElementById("order-date").textContent = new Date(
    order.created_at
  ).toLocaleString("en-BW", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  document.getElementById("delivery-method").innerHTML =
    `<i class="fas fa-car text-purple-600 mr-2"></i>${
      order.delivery_method === "cablink" ? "CabLink Express" : order.delivery_method || "—"
    }`;

  document.getElementById("payment-method").textContent =
    order.payment_method === "paystack" ? "Paystack" : order.payment_method || "—";

  document.getElementById("total-amount").textContent = order.total_amount
    ? `P${Number(order.total_amount).toFixed(2)}`
    : "—";

  const addrEl = document.getElementById("delivery-address");
  if (order.delivery_name || order.delivery_address) {
    addrEl.innerHTML = `
      <p class="text-gray-700">${escapeHtml(order.delivery_name || "")}</p>
      <p class="text-gray-700">${escapeHtml(order.delivery_address || "")}</p>
      <p class="text-gray-700">${escapeHtml(order.delivery_city || "")}, Botswana</p>
      <p class="text-gray-700">${escapeHtml(order.delivery_phone || "")}</p>`;
  }

  // Only CabLink orders have a driver at all — this section was previously
  // shown to every buyer regardless of delivery method, including people
  // who chose self-pickup and have no driver coming.
  if (order.delivery_method === "cablink") {
    const section = document.getElementById("cablink-driver-section");
    const statusEl = document.getElementById("cablink-driver-status");
    if (section) section.classList.remove("hidden");

    const { data: deliveryRequest } = await supabase
      .from("delivery_requests")
      .select("status, cablink_ride_id")
      .eq("order_id", order.id)
      .maybeSingle();

    if (statusEl) {
      if (deliveryRequest?.cablink_ride_id) {
        statusEl.innerHTML =
          '<i class="fas fa-check-circle text-green-500 text-4xl mb-4 block"></i>Sent to a CabLink driver';
      } else {
        statusEl.innerHTML =
          '<i class="fas fa-clock text-4xl mb-4 block"></i>Waiting to be sent to CabLink';
      }
    }
  }

  // THB reward is logged in wallet_ledger against this order
  const { data: reward } = await supabase
    .from("wallet_ledger")
    .select("amount_thb")
    .eq("reference_id", order.id)
    .eq("reference_type", "order")
    .maybeSingle();
  document.getElementById("thb-earned").textContent = reward
    ? reward.amount_thb.toFixed(1)
    : "0.0";

  renderTimeline(order.status);
  if (items) renderItems(items);
}

window.BSTM.ready().then(async function (session) {
  if (!session) {
    window.location.href = "login.html?redirect=order-tracking.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order");

  if (!orderId) {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, total_amount, status, created_at")
      .eq("buyer_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      document.getElementById("order-not-found").classList.remove("hidden");
      return;
    }
    renderOrdersList(orders);
    return;
  }

  await loadOrder(orderId, session);
});

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
BSTM_PATCH_EOF

mkdir -p "$(dirname "order-tracking.html")"
cat > order-tracking.html << 'BSTM_PATCH_EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Track Order - BSTM Marketplace</title>
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#7C3AED">
    <link href="css/tailwind.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
    <style>
        .gradient-bg { background: linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%); }
        .timeline-step { position: relative; }
        .timeline-step::before {
            content: '';
            position: absolute;
            left: 20px;
            top: 40px;
            bottom: -40px;
            width: 2px;
            background: #e5e7eb;
        }
        .timeline-step:last-child::before { display: none; }
        .timeline-step.active::before { background: #7C3AED; }
        .status-dot { width: 40px; height: 40px; }
        .status-dot.active { background: linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%); }
    </style>
</head>
<body class="bg-gray-50">
    <div id="bstm-nav"></div>
    
    <!-- Header -->
    

    <div class="max-w-5xl mx-auto px-6 py-8">
        <!-- Success Message -->
        <div id="order-not-found" class="bg-red-50 border-2 border-red-300 rounded-2xl p-8 mb-8 text-center hidden">
            <h1 class="text-2xl font-bold text-gray-800 mb-2">We couldn't find that order</h1>
            <p class="text-gray-600">Check the link, or visit your <a href="buyer-dashboard.html" class="text-purple-600 font-semibold">dashboard</a> to see all your orders.</p>
        </div>

        <!-- Shown when order-tracking.html is opened with no ?order= id (e.g. from nav/dashboard links) -->
        <div id="orders-list-section" class="hidden">
            <h1 class="text-2xl font-bold text-gray-800 mb-6">Your Orders</h1>
            <div id="orders-list" class="space-y-4"></div>
            <div id="orders-list-empty" class="hidden bg-white rounded-2xl shadow p-8 text-center text-gray-500">
                No orders yet. <a href="marketplace.html" class="text-purple-600 font-semibold">Browse the Mall</a>.
            </div>
        </div>

        <div id="order-content" class="hidden">
        <div class="bg-green-50 border-2 border-green-500 rounded-2xl p-8 mb-8 text-center">
            <div class="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-check text-white text-4xl"></i>
            </div>
            <h1 class="text-3xl font-bold text-gray-800 mb-2">Order Placed Successfully!</h1>
            <p class="text-gray-600 mb-4">Thank you for shopping with BSTM Marketplace</p>
            <p class="text-lg font-semibold text-gray-800">
                Order #<span id="order-number" class="text-purple-600">—</span>
            </p>
            <div class="mt-6 bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 inline-block">
                <p class="text-sm text-gray-700 mb-1">You earned</p>
                <p class="text-2xl font-bold text-yellow-700">
                    <i class="fas fa-coins mr-2"></i><span id="thb-earned">0.0</span> THB
                </p>
            </div>
        </div>

        <!-- Order Details -->
        <div class="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 class="text-2xl font-bold text-gray-800 mb-6">Order Details</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <p class="text-sm text-gray-600 mb-1">Order Placed</p>
                    <p id="order-date" class="text-lg font-bold text-gray-800">—</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600 mb-1">Delivery Method</p>
                    <p id="delivery-method" class="text-lg font-bold text-gray-800">
                        <i class="fas fa-car text-purple-600 mr-2"></i>—
                    </p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <p class="text-sm text-gray-600 mb-1">Payment Method</p>
                    <p id="payment-method" class="text-lg font-bold text-gray-800">—</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600 mb-1">Total Amount</p>
                    <p id="total-amount" class="text-lg font-bold text-gray-800">—</p>
                </div>
            </div>

            <div class="border-t pt-6">
                <h3 class="font-bold text-gray-800 mb-4">Delivery Address</h3>
                <div id="delivery-address">
                    <p class="text-gray-500">—</p>
                </div>
            </div>
        </div>

        <!-- Order Tracking Timeline -->
        <div class="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 class="text-2xl font-bold text-gray-800 mb-8">Order Status</h2>
            <div id="order-timeline" class="space-y-8"></div>
        </div>

        <!-- Order Items -->
        <div class="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 class="text-2xl font-bold text-gray-800 mb-6">Items in Your Order</h2>
            <div id="order-items-list" class="space-y-4"></div>
        </div>
        </div><!-- /#order-content -->

        <!-- Driver Info (When available) -->
        <div id="cablink-driver-section" class="hidden bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl shadow-lg p-8 mb-8">
            <h2 class="text-2xl font-bold text-gray-800 mb-6">
                <i class="fas fa-car text-purple-600 mr-2"></i>CabLink Driver
            </h2>
            <div class="bg-white rounded-xl p-6">
                <p id="cablink-driver-status" class="text-center text-gray-500 py-8">
                    <i class="fas fa-clock text-4xl mb-4 block"></i>
                    Waiting to be sent to CabLink
                </p>
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button class="bg-white border-2 border-purple-600 text-purple-600 hover:bg-purple-50 py-4 px-6 rounded-xl font-bold transition-all">
                <i class="fas fa-comment mr-2"></i>Contact Seller
            </button>
            <button class="bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 py-4 px-6 rounded-xl font-bold transition-all">
                <i class="fas fa-headset mr-2"></i>Help & Support
            </button>
            <a href="buyer-dashboard.html" class="gradient-bg text-white text-center py-4 px-6 rounded-xl font-bold hover:shadow-2xl transition-all">
                <i class="fas fa-home mr-2"></i>Back to Dashboard
            </a>
        </div>
    </div>

    <!-- Footer -->
    

    <div id="bstm-footer"></div>
    <script src="components/smart-loader.js"></script>
<script type="module" src="js/app.js?v=1788846845"></script>

<script type="module" src="js/pages/order-tracking.js?v=1788260255"></script>

</body>
</html>
BSTM_PATCH_EOF

mkdir -p "$(dirname "js/pages/checkout.js")"
cat > js/pages/checkout.js << 'BSTM_PATCH_EOF'
// js/pages/checkout.js
import { supabase } from "../core/supabase-client.js";
import { getCart, getCartGroupedByRoom, getCartTotal, clearCart } from "../core/cart.js";
import { escapeHtml } from "../core/sanitize.js";
import { CONFIG } from "../core/config.js";
import { logEvent } from "../core/events.js";

const REWARD_PERCENT = CONFIG.MARKETPLACE.REWARD_PERCENT / 100; // e.g. 1%

function getDeliveryFee() {
  const checked = document.querySelector('input[name="delivery"]:checked');
  return checked ? Number(checked.dataset.fee || 0) : 0;
}

function renderCart() {
  const cart = getCart();
  const itemsEl = document.getElementById("checkout-items");
  const subtotalEl = document.getElementById("checkout-subtotal");
  const totalEl = document.getElementById("checkout-total");
  const thbEl = document.getElementById("checkout-thb-reward");
  const deliveryFeeEl = document.getElementById("checkout-delivery-fee");
  const placeOrderBtn = document.getElementById("place-order-btn");

  if (!itemsEl) return cart;

  if (cart.length === 0) {
    itemsEl.innerHTML =
      '<p class="text-gray-500 text-sm">Your cart is empty. ' +
      '<a href="marketplace.html" class="text-purple-600 font-semibold">Go shopping →</a></p>';
    if (placeOrderBtn) placeOrderBtn.disabled = true;
    if (subtotalEl) subtotalEl.textContent = "P0";
    if (totalEl) totalEl.textContent = "P0";
    if (thbEl) thbEl.textContent = "0.0";
    return cart;
  }

  const groups = getCartGroupedByRoom();
  const multiRoom = groups.length > 1;

  itemsEl.innerHTML = groups
    .map(
      (group) => `
      <div class="mb-4 pb-4 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
        ${
          multiRoom
            ? `<div class="flex items-center justify-between mb-2">
                 <span class="text-xs font-bold text-purple-600 uppercase tracking-wide">🏬 ${escapeHtml(group.room_name)}</span>
                 <span class="text-xs text-gray-400">Separate order — this seller ships independently</span>
               </div>`
            : ""
        }
        ${group.items
          .map(
            (item) => `
          <div class="flex items-center space-x-4 mb-2">
            <img src="${escapeHtml(item.image || "")}" onerror="this.style.display='none'" alt="${escapeHtml(item.name)}" class="w-16 h-16 rounded-lg object-cover bg-purple-50">
            <div class="flex-1">
              <h4 class="font-semibold text-gray-800">${escapeHtml(item.name)}</h4>
              <p class="text-sm text-gray-600">Qty: ${item.qty}</p>
            </div>
            <span class="font-bold text-gray-800">P${(item.price * item.qty).toFixed(2)}</span>
          </div>`
          )
          .join("")}
        ${multiRoom ? `<p class="text-right text-sm text-gray-500 mt-1">Room subtotal: P${group.subtotal.toFixed(2)}</p>` : ""}
      </div>`
    )
    .join("");

  const subtotal = getCartTotal();
  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;
  const reward = Math.round(subtotal * REWARD_PERCENT); // reward is based on goods, not delivery fee — rounded to match what actually gets credited (see handlePlaceOrder)

  if (subtotalEl) subtotalEl.textContent = `P${subtotal.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `P${total.toFixed(2)}`;
  if (thbEl) thbEl.textContent = reward.toFixed(1);
  if (deliveryFeeEl) {
    if (deliveryFee > 0) {
      deliveryFeeEl.textContent = `P${deliveryFee.toFixed(2)}`;
      deliveryFeeEl.classList.remove("text-green-600");
    } else {
      deliveryFeeEl.textContent = "FREE";
      deliveryFeeEl.classList.add("text-green-600");
    }
  }

  if (multiRoom) {
    let note = document.getElementById("checkout-multiroom-note");
    if (!note) {
      note = document.createElement("p");
      note.id = "checkout-multiroom-note";
      note.className = "text-xs text-gray-500 mt-2";
      itemsEl.parentElement?.insertBefore(note, itemsEl.nextSibling);
    }
    note.textContent = `Your items are from ${groups.length} different rooms — this will create ${groups.length} separate orders, one per seller, each with its own tracking.`;
  }

  const hasAnyService = groups.some((g) => g.hasService);
  const serviceNote = document.getElementById("service-delivery-note");
  if (serviceNote) serviceNote.classList.toggle("hidden", !hasAnyService);

  return cart;
}

function showError(msg) {
  const el = document.getElementById("checkout-error");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearError() {
  const el = document.getElementById("checkout-error");
  if (!el) return;
  el.classList.add("hidden");
}

async function createOrder(session, cart, { deliveryFee, orderStatus, paystackRef }) {
  const userId = session.user.id;

  const form = document.getElementById("checkoutForm");
  const delivery = {
    delivery_name: form.fullName.value,
    delivery_phone: form.phone.value,
    delivery_address: form.address.value,
    delivery_city: form.city.value,
    delivery_notes: form.notes.value || null,
  };
  const deliveryMethod =
    document.querySelector('input[name="delivery"]:checked')?.value || "cablink";
  const paymentMethod =
    document.querySelector('input[name="payment"]:checked')?.value || "paystack";

  // Each room is a separate seller — split the cart into one order per room
  // rather than one order for the whole basket. A shopper buying from 3
  // rooms in one checkout ends up with 3 independent orders, each visible
  // only to its own seller, each trackable separately. Delivery fee is
  // split evenly across room-orders rather than charged per-room again.
  const groups = getCartGroupedByRoom();
  const createdOrders = [];
  const feePerOrder = groups.length > 0 ? deliveryFee / groups.length : 0;

  for (const group of groups) {
    // A service-only room order (e.g. booking a haircut) has no physical
    // delivery — dispatching a CabLink pickup for it would be nonsense.
    const effectiveDeliveryMethod = group.hasService && !group.hasPhysical ? "service" : deliveryMethod;

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        buyer_id: userId,
        product_id: group.items[0].id, // kept for backward-compat joins
        room_id: group.room_id,
        seller_id: group.seller_id,
        status: orderStatus,
        total_amount: group.subtotal + feePerOrder,
        delivery_method: effectiveDeliveryMethod,
        payment_method: paymentMethod,
        paystack_reference: paystackRef || null,
        ...delivery,
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    const items = group.items.map((item) => ({
      order_id: order.id,
      product_id: item.id,
      product_name: item.name,
      quantity: item.qty,
      unit_price: item.price,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(items);
    if (itemsErr) throw itemsErr;

    // Auto-create a CabLink pickup task for this room's order so it shows
    // up ready-to-claim in the real CabLink driver app — no manual step
    // needed from the buyer or seller. Skipped entirely for service-only
    // orders (the buyer enquires/books with the seller directly).
    if (effectiveDeliveryMethod === "cablink" && group.room_id) {
      const { data: deliveryRequest, error: deliveryErr } = await supabase
        .from("delivery_requests")
        .insert({
          order_id: order.id,
          buyer_id: userId,
          pickup_room_id: group.room_id,
          dropoff_address: delivery.delivery_address,
          dropoff_city: delivery.delivery_city,
          dropoff_phone: delivery.delivery_phone,
          status: "pending",
        })
        .select("id")
        .single();

      // Actually hand the task to CabLink's real driver network. This is
      // best-effort on purpose: if CabLink is briefly unreachable or the
      // shared key isn't configured yet, the order must still succeed —
      // the row above stays "pending" and can be retried later rather
      // than blocking checkout.
      if (!deliveryErr && deliveryRequest) {
        try {
          const { error: dispatchErr } = await supabase.functions.invoke(
            "dispatch-to-cablink",
            { body: { delivery_request_id: deliveryRequest.id } }
          );
          if (dispatchErr) {
            console.error("[BSTM Checkout] CabLink dispatch failed (order still placed):", dispatchErr);
          }
        } catch (dispatchException) {
          console.error("[BSTM Checkout] CabLink dispatch threw (order still placed):", dispatchException);
        }
      } else if (deliveryErr) {
        console.error("[BSTM Checkout] Couldn't create delivery_requests row:", deliveryErr);
      }
    }

    createdOrders.push(order);
    logEvent("order_placed", {
      userId,
      roomId: group.room_id,
      orderId: order.id,
      metadata: {
        item_count: group.items.length,
        total: group.subtotal + feePerOrder,
        payment_method: paymentMethod,
        delivery_method: effectiveDeliveryMethod,
      },
    });
  }

  // Reward THB — credited immediately for MVP. In production this should be
  // confirmed server-side once the Paystack webhook verifies payment.
  // One ledger row PER ORDER (not one combined row on the first order) so
  // each room's own order-tracking page shows the reward that order actually
  // earned, instead of order #1 showing the whole basket's reward and every
  // other room's order showing 0.
  let totalReward = 0;
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const order = createdOrders[i];
    const orderReward = Math.round(group.subtotal * REWARD_PERCENT);
    if (orderReward > 0) {
      const { error: rewardErr } = await supabase.from("wallet_ledger").insert({
        user_id: userId,
        amount_thb: orderReward,
        type: "credit",
        reference_type: "order",
        reference_id: order.id,
        meta: { reason: "purchase_reward" },
      });
      if (!rewardErr) totalReward += orderReward;
      else console.error("[BSTM Checkout] Reward ledger insert failed for order", order.id, rewardErr);
    }
  }

  // profiles.thb_balance is what every other page (buyer dashboard, settings,
  // THB wallet) actually reads — crediting wallet_ledger alone never moved
  // that number, so a buyer's earned reward was invisible everywhere except
  // a live sum of the ledger. This keeps the two in sync from the one place
  // that creates purchase-reward ledger rows. Not atomic (read-then-write),
  // same limitation as the rest of this client-side codebase; a concurrent
  // reward (e.g. two tabs checking out at once) could race here.
  if (totalReward > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("thb_balance")
      .eq("id", userId)
      .single();
    const newBalance = Number(profile?.thb_balance || 0) + totalReward;
    const { error: balanceErr } = await supabase
      .from("profiles")
      .update({ thb_balance: newBalance })
      .eq("id", userId);
    if (balanceErr) console.error("[BSTM Checkout] thb_balance update failed:", balanceErr);
  }

  return createdOrders;
}

async function handlePlaceOrder() {
  clearError();

  const form = document.getElementById("checkoutForm");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const cart = getCart();
  if (cart.length === 0) {
    showError("Your cart is empty.");
    return;
  }

  const session = await window.BSTM.ready();
  if (!session) {
    window.location.href = "login.html?redirect=checkout.html";
    return;
  }

  const btn = document.getElementById("place-order-btn");
  btn.disabled = true;
  btn.textContent = "Processing…";

  const subtotal = getCartTotal();
  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;
  const email = document.getElementById("email").value;
  const paymentMethod =
    document.querySelector('input[name="payment"]:checked')?.value || "paystack";

  // Reserve stock BEFORE payment, not after — nobody should be charged for
  // something that's actually out of stock. Each decrement is atomic at the
  // database level (see decrement_product_stock), so two buyers racing for
  // the last unit can never both succeed. If anything fails here, roll back
  // whatever already succeeded and stop before payment is even attempted.
  const reserved = [];
  for (const item of cart) {
    const { data: ok, error: stockErr } = await supabase.rpc(
      "decrement_product_stock",
      { p_product_id: item.id, p_qty: item.qty }
    );
    if (stockErr || !ok) {
      for (const r of reserved) {
        await supabase.rpc("restore_product_stock", {
          p_product_id: r.id,
          p_qty: r.qty,
        });
      }
      showError(`"${item.name}" doesn't have enough stock left. Please adjust your cart.`);
      btn.disabled = false;
      btn.textContent = "Place Order";
      return;
    }
    reserved.push({ id: item.id, qty: item.qty });
  }

  async function restoreAllReserved() {
    for (const r of reserved) {
      await supabase.rpc("restore_product_stock", { p_product_id: r.id, p_qty: r.qty });
    }
  }

  // Cash on Delivery: genuinely different path — no payment gateway at all.
  // Order is created as "pending" since payment hasn't happened yet; it's
  // confirmed at the point of physical handover, not here.
  if (paymentMethod === "cod") {
    try {
      const orders = await createOrder(session, cart, {
        deliveryFee,
        orderStatus: "pending",
        paystackRef: null,
      });
      clearCart();
      const orderIds = orders.map((o) => o.id).join(",");
      window.location.href = `order-tracking.html?order=${orders[0].id}&orders=${orderIds}`;
    } catch (err) {
      console.error("[BSTM Checkout] COD order creation failed:", err);
      await restoreAllReserved();
      showError("Couldn't place your order. Please try again.");
      btn.disabled = false;
      btn.textContent = "Place Order";
    }
    return;
  }

  // NOTE: This confirms payment on the client-side Paystack callback, which
  // is fine for early testing but is NOT secure for real money — a user
  // could fake success without paying. Before going live, verify payment
  // server-side via a Paystack webhook (see backend/) before creating the
  // order. Flagging this clearly rather than hiding it.
  if (!window.PaystackPop || CONFIG.API.PAYSTACK_PUBLIC === "pk_live_xxx") {
    await restoreAllReserved();
    showError(
      "Payment isn't configured yet — add a real Paystack public key in js/core/config.js before going live."
    );
    btn.disabled = false;
    btn.textContent = "Place Order";
    return;
  }

  const handler = PaystackPop.setup({
    key: CONFIG.API.PAYSTACK_PUBLIC,
    email: email,
    amount: Math.round(total * 100), // kobo/thebe — now correctly includes delivery fee
    currency: CONFIG.PAYSTACK.CURRENCY,
    ref: "BSTM-" + Date.now() + "-" + Math.floor(Math.random() * 10000),
    callback: function (response) {
      createOrder(session, cart, {
        deliveryFee,
        orderStatus: "confirmed",
        paystackRef: response.reference,
      })
        .then((orders) => {
          clearCart();
          const orderIds = orders.map((o) => o.id).join(",");
          window.location.href = `order-tracking.html?order=${orders[0].id}&orders=${orderIds}&ref=${response.reference}`;
        })
        .catch((err) => {
          // Payment already succeeded here — do NOT restore stock, since
          // this buyer did pay for it. This becomes a support case instead
          // of silently letting someone else buy the same unit.
          console.error("[BSTM Checkout] Order creation failed:", err);
          showError(
            "Payment succeeded but saving your order failed. Contact support with reference " +
              response.reference
          );
          btn.disabled = false;
          btn.textContent = "Place Order";
        });
    },
    onClose: async function () {
      await restoreAllReserved();
      btn.disabled = false;
      btn.textContent = "Place Order";
    },
  });

  handler.openIframe();
}

window.BSTM.ready().then(async function (session) {
  if (!session) {
    window.location.href = "login.html?redirect=checkout.html";
    return;
  }

  const emailEl = document.getElementById("email");
  const nameEl = document.getElementById("fullName");
  if (emailEl && !emailEl.value) emailEl.value = session.user.email;
  if (nameEl && !nameEl.value)
    nameEl.value =
      session.user.user_metadata?.full_name || session.user.email.split("@")[0];

  const { data: profile } = await supabase
    .from("profiles")
    .select("thb_balance")
    .eq("id", session.user.id)
    .maybeSingle();
  const balanceEl = document.getElementById("thb-balance-display");
  if (balanceEl) balanceEl.textContent = Number(profile?.thb_balance || 0).toFixed(1);

  renderCart();

  document.querySelectorAll('input[name="delivery"]').forEach((el) => {
    el.addEventListener("change", renderCart);
  });

  const btn = document.getElementById("place-order-btn");
  if (btn) btn.addEventListener("click", handlePlaceOrder);
});

window.addEventListener("bstm:cartUpdated", renderCart);
window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
BSTM_PATCH_EOF

mkdir -p "$(dirname ".github/workflows/deploy.yml")"
cat > .github/workflows/deploy.yml << 'BSTM_PATCH_EOF'
name: Deploy BSTM Digital Nation

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        npm install -g htmlhint
        npm ci

    - name: Build production CSS
      run: npm run build:css

    - name: Validate HTML
      run: htmlhint **/*.html
    
    - name: Check for secrets in code
      run: |
        # A real Paystack public key is pk_live_ followed by a long random
        # string. This used to match on the bare "pk_live_" prefix, which
        # also matches our own placeholder ('pk_live_xxx' in js/core/config.js
        # and docs) and even this grep command's own line in this file --
        # meaning the check failed on every run regardless of whether a real
        # key was ever committed. Requiring 20+ trailing chars, and excluding
        # this workflow file, node_modules and .git, makes it only fire on an
        # actual key.
        if grep -rE "pk_live_[A-Za-z0-9]{20,}" --exclude-dir=.git --exclude-dir=node_modules --exclude=deploy.yml .; then
          echo "Error: Live API keys found in code!"
          exit 1
        fi
    
    - name: Deploy to GitHub Pages
      if: github.ref == 'refs/heads/main'
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./
        cname: bstm.bw
    
    - name: Notify Telegram
      if: success()
      run: |
        curl -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
        -d chat_id=${{ secrets.TELEGRAM_CHAT_ID }} \
        -d text="✅ BSTM deployed successfully to production!"
BSTM_PATCH_EOF

echo "All files written. Checking JS syntax..."
node --check js/pages/product-detail.js && node --check js/pages/order-tracking.js && node --check js/pages/checkout.js && echo 'Syntax OK'

git add -A
git commit -m "Fix: buy-now stock guard, order tracking list view, THB reward sync + per-order split, CI secrets-check false positive"
git push
echo "Done — pushed. Check the Actions tab on GitHub to confirm the deploy pipeline now passes."
