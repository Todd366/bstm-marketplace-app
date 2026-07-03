// room22-farm.js
import { supabase } from "../core/supabase-client.js";

document.addEventListener("DOMContentLoaded", async function() {
  var grid = document.getElementById("products-grid")
    || document.getElementById("farm-grid")
    || document.getElementById("product-grid")
    || document.querySelector(".products-grid");
  if (!grid) return;

  var { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("category", "fresh-produce")
    .order("created_at", { ascending: false })
    .limit(24);

  // Fall back to all products if no farm products yet
  if (!products || products.length === 0) {
    var res = await supabase.from("products").select("*").limit(24);
    products = res.data || [];
  }

  if (error || products.length === 0) {
    grid.innerHTML = '<div style="text-align:center;padding:60px;grid-column:1/-1;">'
      + '<div style="font-size:56px;margin-bottom:12px;">🌾</div>'
      + '<p style="color:#9CA3AF;font-size:14px;">No products listed yet. Check back soon!</p>'
      + '<a href="upload-product.html" style="display:inline-block;margin-top:16px;'
      + 'background:linear-gradient(135deg,#059669,#34D399);color:#fff;padding:12px 24px;'
      + 'border-radius:12px;font-weight:800;text-decoration:none;">List Your Product →</a></div>';
    return;
  }

  grid.innerHTML = products.map(function(p) {
    var img   = p.image_url || p.image || "";
    var price = Number(p.price || 0).toFixed(2);
    return '<div style="background:#fff;border-radius:20px;overflow:hidden;border:1.5px solid #6EE7B7;'
      + 'cursor:pointer;transition:all 0.3s;" onclick="window.location.href=\'product-detail.html?id=' + p.id + '\'">'
      + '<div style="height:160px;background:linear-gradient(135deg,#059669,#34D399);'
      + 'display:flex;align-items:center;justify-content:center;overflow:hidden;">'
      + (img ? '<img src="' + img + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">'
             : '<span style="font-size:48px;">🌾</span>')
      + '</div>'
      + '<div style="padding:16px;">'
      + '<div style="font-weight:800;color:#1E1B4B;font-size:15px;margin-bottom:4px;">'
      + (p.title || "Farm Product") + '</div>'
      + '<div style="font-size:18px;font-weight:900;color:#059669;margin-bottom:12px;">P' + price + '</div>'
      + '<a href="product-detail.html?id=' + p.id + '" style="display:block;background:linear-gradient(135deg,#059669,#34D399);'
      + 'color:#fff;padding:10px;border-radius:10px;font-weight:700;font-size:13px;text-decoration:none;text-align:center;">'
      + 'View Product →</a></div></div>';
  }).join("");
});
