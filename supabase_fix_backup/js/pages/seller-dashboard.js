import { getProfile, getProducts } from "../bstm-core.js";

async function render(session) {
  if (!session) {
    document.getElementById("auth-wall").style.display = "flex";
    document.getElementById("seller-content").style.display = "none";
    return;
  }

  var user = session.user;
  document.getElementById("seller-content").style.display = "block";
  document.getElementById("auth-wall").style.display = "none";
  document.getElementById("seller-name").textContent = user.email.split("@")[0];

  var { data: profile } = await getProfile(user.id);
  if (profile && document.getElementById("seller-thb")) {
    document.getElementById("seller-thb").textContent = (profile.thb_balance || 0).toFixed(2);
  }

  var { data: products } = await getProducts({ seller_id: user.id });
  if (products && document.getElementById("stat-products")) {
    document.getElementById("stat-products").textContent = products.length;
  }
}

window.BSTM.ready().then(render);
window.addEventListener("bstm:logout", () => render(null));

window.logout = function() {
  if (confirm("Logout?")) {
    window.BSTM.logout();
  }
};
