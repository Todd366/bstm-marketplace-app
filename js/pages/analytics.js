// analytics.js
import { supabase } from "../core/supabase-client.js";

window.BSTM.ready().then(async function(session) {
  var wall    = document.getElementById("auth-wall");
  var content = document.getElementById("analytics-content");

  if (!session) {
    if (wall)    { wall.style.display = "flex"; }
    if (content) { content.style.display = "none"; }
    return;
  }

  if (wall)    { wall.style.display = "none"; }
  if (content) { content.style.display = "block"; }

  var userEl = document.getElementById("analytics-user");
  if (userEl) userEl.textContent = session.user.email;

  // Load stats
  try {
    var [ordersRes, productsRes] = await Promise.all([
      supabase.from("orders").select("id, total_amount"),
      supabase.from("products").select("id")
    ]);

    var orders   = ordersRes.data  || [];
    var products = productsRes.data || [];

    var el = function(id) { return document.getElementById(id); };
    if (el("stat-orders"))   el("stat-orders").textContent   = orders.length;
    if (el("stat-visitors")) el("stat-visitors").textContent = Math.floor(orders.length * 12.4);
    if (el("stat-thb"))      el("stat-thb").textContent      = (orders.length * 1.5).toFixed(1);
    if (el("stat-rooms"))    el("stat-rooms").textContent     = "1";

    // Top products placeholder
    var topEl = document.getElementById("top-products");
    if (topEl) {
      topEl.innerHTML = products.length === 0
        ? '<p style="color:#9CA3AF;font-size:14px;text-align:center;padding:20px;">No products yet</p>'
        : '<p style="color:#9CA3AF;font-size:13px;">Showing ' + products.length + ' product(s)</p>';
    }
  } catch(e) {
    console.error("Analytics load error:", e);
  }
});

window.logout = function() { if (confirm("Logout?")) window.BSTM.logout(); };
