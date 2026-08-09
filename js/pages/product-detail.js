// js/pages/product-detail.js
import { supabase } from "../core/supabase-client.js";
import { addToCart } from "../core/cart.js";
import { addToWishlist, removeFromWishlist } from "../bstm-core.js";

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

  document.title = (p.name || "Product") + " — BSTM Mall";

  const set = function (sel, val) {
    document.querySelectorAll(sel).forEach(function (el) {
      el.textContent = val;
    });
  };

  set("#product-title", p.name || "Product");
  set("#product-price", "P" + Number(p.price || 0).toFixed(2));
  set("#product-thb", "or " + (Number(p.price || 0) * 0.01).toFixed(2) + " THB");
  set("#product-description", p.description || "No description available.");
  set("#product-category", p.category || "");

  const img = p.image || "";
  const imgEl = document.getElementById("mainImage");
  if (imgEl && img) {
    imgEl.src = img;
    imgEl.alt = p.name || "Product";
  }

  // Resolve seller display name (best-effort — profiles may not have a name set)
  if (p.seller_id) {
    const { data: seller } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", p.seller_id)
      .maybeSingle();
    set("#seller-name-display", seller?.full_name || seller?.email?.split("@")[0] || "BSTM Seller");
  } else {
    set("#seller-name-display", "BSTM Marketplace");
  }

  // Quantity selector — real state instead of the old no-op increase/decreaseQty
  const qtyInput = document.getElementById("quantity");
  window.increaseQty = function () {
    if (!qtyInput) return;
    qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) + 1);
  };
  window.decreaseQty = function () {
    if (!qtyInput) return;
    qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
  };

  function buildCartItem() {
    const qty = Math.max(1, parseInt(qtyInput?.value, 10) || 1);
    return { id: p.id, name: p.name, price: Number(p.price), image: p.image, qty };
  }

  const addBtn = document.getElementById("add-to-cart-btn");
  if (addBtn) {
    addBtn.addEventListener("click", function () {
      window.addToCart(buildCartItem());
    });
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
    buyNowBtn.addEventListener("click", function (e) {
      e.preventDefault();
      addToCart(buildCartItem());
      window.location.href = "checkout.html";
    });
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

  // Store product in sessionStorage for legacy checkout paths that read it
  sessionStorage.setItem("checkout_product", JSON.stringify(p));
});
