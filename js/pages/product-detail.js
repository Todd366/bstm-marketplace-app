// product-detail.js
import { supabase } from "../core/supabase-client.js";

document.addEventListener("DOMContentLoaded", async function() {
  var id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  var { data: p, error } = await supabase
    .from("products").select("*").eq("id", id).single();

  if (error || !p) {
    var main = document.querySelector("main") || document.body;
    main.innerHTML = '<div style="text-align:center;padding:80px 20px;">'
      + '<div style="font-size:56px;margin-bottom:16px;">😕</div>'
      + '<p style="color:#9CA3AF;font-size:15px;margin-bottom:24px;">Product not found.</p>'
      + '<a href="marketplace.html" style="background:linear-gradient(135deg,#7C3AED,#4F46E5);'
      + 'color:#fff;padding:14px 28px;border-radius:14px;font-weight:800;text-decoration:none;">Browse Mall →</a></div>';
    return;
  }

  // Title
  document.title = (p.title || "Product") + " — BSTM Mall";
  [["#product-title",".product-title"], ["#product-category",""]].forEach(function(pair) {});

  var set = function(sel, val) {
    document.querySelectorAll(sel).forEach(function(el) { el.textContent = val; });
  };
  set("#product-title",       p.title || "Product");
  set(".product-title",       p.title || "Product");
  set("#product-price",       "P" + Number(p.price || 0).toFixed(2));
  set(".product-price",       "P" + Number(p.price || 0).toFixed(2));
  set("#product-description", p.description || "No description available.");
  set(".product-desc",        p.description || "");
  set("#product-category",    p.category || "");
  set("#product-category-badge", (p.category || "PRODUCT").toUpperCase());

  var img = p.image_url || p.image || "";
  var imgEl = document.getElementById("mainImage");
  if (imgEl && img) { imgEl.src = img; imgEl.alt = p.title || "Product"; }

  // Store product in sessionStorage for checkout
  sessionStorage.setItem("checkout_product", JSON.stringify(p));
});
