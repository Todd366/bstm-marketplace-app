import { getProfile, getProducts } from "../bstm-core.js";

async function render(session) {
  if (!session) {
    var wall = document.getElementById("auth-wall");
    var content = document.getElementById("seller-content");
    if (wall) wall.style.display = "flex";
    if (content) content.style.display = "none";
    return;
  }

  var user = session.user;
  var wall = document.getElementById("auth-wall");
  var content = document.getElementById("seller-content");
  if (wall) wall.style.display = "none";
  if (content) content.style.display = "block";

  var nameEl = document.getElementById("seller-name");
  if (nameEl) nameEl.textContent = user.email.split("@")[0];

  // Live profile columns: id, email, role, thb_balance
  var { data: profile } = await getProfile(user.id);
  if (profile) {
    var thbEl = document.getElementById("seller-thb");
    if (thbEl) thbEl.textContent = (profile.thb_balance || 0).toFixed(2) + " THB";
  }

  // Live products columns: id, name, price, image, seller_id, created_at
  var { data: products } = await getProducts({ seller_id: user.id });
  if (products) {
    var prodEl = document.getElementById("stat-products");
    if (prodEl) prodEl.textContent = products.length;
  }
}

window.BSTM.ready().then(render);
window.addEventListener("bstm:logout", function() { render(null); });

window.logout = function() {
  if (confirm("Logout?")) {
    window.BSTM.logout();
  }
};
