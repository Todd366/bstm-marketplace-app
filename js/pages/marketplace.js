import { getProducts, normalizeProduct } from "../bstm-core.js";

document.addEventListener("DOMContentLoaded", async function() {
  var grid = document.getElementById("product-grid")
           || document.getElementById("rooms-grid")
           || document.getElementById("marketplace-grid")
           || document.querySelector(".products-grid");

  if (!grid) return; // page might not have a product grid

  var { data: products, error } = await getProducts();

  if (error || !products || products.length === 0) {
    // Show empty state if one exists, otherwise leave static content
    var empty = document.getElementById("no-products") || document.getElementById("empty-state");
    if (empty) empty.style.display = "block";
    return;
  }

  // Render real products
  grid.innerHTML = products.map(function(raw) {
    var p = normalizeProduct(raw);
    return [
      '<div style="background:#fff;border-radius:20px;overflow:hidden;border:1.5px solid #EDE9FE;transition:all 0.3s;cursor:pointer;"',
      '  onclick="window.location.href=\'product-detail.html?id=' + p.id + '\'">',
      '  <div style="height:180px;background:linear-gradient(135deg,#F5F3FF,#EEF2FF);display:flex;align-items:center;justify-content:center;overflow:hidden;">',
           p.image
             ? '<img src="' + p.image + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">'
             : '<span style="font-size:56px;">📦</span>',
      '  </div>',
      '  <div style="padding:16px;">',
      '    <div style="font-weight:900;color:#1E1B4B;font-size:16px;margin-bottom:6px;">' + (p.title || "Product") + '</div>',
      '    <div style="font-size:20px;font-weight:900;color:#7C3AED;margin-bottom:12px;">P' + Number(p.price).toFixed(2) + '</div>',
      '    <a href="product-detail.html?id=' + p.id + '"',
      '       style="display:block;background:linear-gradient(135deg,#7C3AED,#4F46E5);color:#fff;padding:10px;',
      '              border-radius:10px;font-weight:700;font-size:13px;text-decoration:none;text-align:center;">',
      '      View Product',
      '    </a>',
      '  </div>',
      '</div>'
    ].join("");
  }).join("");
});
