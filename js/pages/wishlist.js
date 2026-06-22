import { getWishlist, removeFromWishlist, normalizeProduct } from "../bstm-core.js";

function showSection(id) {
  ["auth-wall", "wishlist-content", "empty-wishlist"].forEach(function(s) {
    var el = document.getElementById(s);
    if (el) el.style.display = s === id ? "block" : "none";
  });
}

function buildCard(item) {
  var p = normalizeProduct(item.products);
  if (!p) return "";
  return [
    '<div style="background:#fff;border-radius:20px;overflow:hidden;border:1.5px solid #EDE9FE;transition:all 0.3s;">',
      '<div style="height:160px;background:linear-gradient(135deg,#F5F3FF,#EEF2FF);display:flex;align-items:center;justify-content:center;overflow:hidden;">',
        p.image
          ? '<img src="' + p.image + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">'
          : '<span style="font-size:48px;">📦</span>',
      '</div>',
      '<div style="padding:16px;">',
        '<div style="font-weight:900;color:#1E1B4B;font-size:16px;margin-bottom:6px;">' + (p.title || "Product") + '</div>',
        '<div style="font-size:22px;font-weight:900;color:#7C3AED;margin-bottom:12px;">P' + Number(p.price || 0).toFixed(2) + '</div>',
        '<div style="display:flex;gap:8px;">',
          '<a href="product-detail.html?id=' + p.id + '" style="flex:1;background:linear-gradient(135deg,#7C3AED,#4F46E5);color:#fff;padding:10px;border-radius:10px;font-weight:700;font-size:13px;text-decoration:none;text-align:center;">View</a>',
          '<button onclick="removeItem(\'' + item.user_id + '\',\'' + item.product_id + '\')" style="background:#FEE2E2;color:#991B1B;border:none;padding:10px 14px;border-radius:10px;font-size:13px;cursor:pointer;font-weight:700;">Remove</button>',
        '</div>',
      '</div>',
    '</div>'
  ].join("");
}

async function loadWishlist(session) {
  if (!session) {
    showSection("auth-wall");
    return;
  }

  var { data: items, error } = await getWishlist(session.user.id);

  if (error) {
    console.error("Wishlist load error:", error);
    showSection("empty-wishlist");
    return;
  }

  if (!items || items.length === 0) {
    showSection("empty-wishlist");
    return;
  }

  showSection("wishlist-content");
  var grid = document.getElementById("wishlist-grid");
  if (grid) grid.innerHTML = items.map(buildCard).join("");
}

window.BSTM.ready().then(loadWishlist);
window.addEventListener("bstm:logout", function() { loadWishlist(null); });

window.removeItem = async function(userId, productId) {
  if (!confirm("Remove from wishlist?")) return;
  var { error } = await removeFromWishlist(userId, productId);
  if (error) {
    alert("Failed to remove. Please try again.");
    return;
  }
  var session = window.BSTM.getSession();
  loadWishlist(session);
};
