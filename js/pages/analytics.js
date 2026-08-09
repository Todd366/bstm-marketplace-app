// js/pages/analytics.js
import { supabase } from "../core/supabase-client.js";

window.BSTM.ready().then(async function (session) {
  const wall = document.getElementById("auth-wall");
  const content = document.getElementById("analytics-content");

  if (!session) {
    if (wall) wall.style.display = "flex";
    if (content) content.style.display = "none";
    return;
  }

  if (wall) wall.style.display = "none";
  if (content) content.style.display = "block";

  const userEl = document.getElementById("analytics-user");
  if (userEl) userEl.textContent = session.user.email;

  const userId = session.user.id;

  const { data: myProducts } = await supabase
    .from("products")
    .select("id, name")
    .eq("seller_id", userId);

  const products = myProducts || [];
  const productIds = products.map((p) => p.id);

  document.getElementById("stat-products").textContent = products.length;

  if (productIds.length === 0) {
    document.getElementById("stat-orders").textContent = "0";
    document.getElementById("stat-revenue").textContent = "P0.00";
    document.getElementById("stat-aov").textContent = "P0.00";
    document.getElementById("top-products").innerHTML =
      '<p class="text-gray-400 text-sm">List a product to start seeing analytics.</p>';
    return;
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, product_id, quantity, unit_price")
    .in("product_id", productIds);

  const rows = items || [];
  const orderIds = new Set(rows.map((r) => r.order_id));
  const revenue = rows.reduce((sum, r) => sum + r.quantity * r.unit_price, 0);
  const aov = orderIds.size > 0 ? revenue / orderIds.size : 0;

  document.getElementById("stat-orders").textContent = orderIds.size;
  document.getElementById("stat-revenue").textContent = `P${revenue.toFixed(2)}`;
  document.getElementById("stat-aov").textContent = `P${aov.toFixed(2)}`;

  // Real top products by revenue
  const byProduct = {};
  rows.forEach((r) => {
    if (!byProduct[r.product_id]) byProduct[r.product_id] = { revenue: 0, units: 0 };
    byProduct[r.product_id].revenue += r.quantity * r.unit_price;
    byProduct[r.product_id].units += r.quantity;
  });

  const ranked = Object.entries(byProduct)
    .map(([id, stats]) => ({
      name: products.find((p) => p.id === id)?.name || "Unknown product",
      ...stats,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const topEl = document.getElementById("top-products");
  if (ranked.length === 0) {
    topEl.innerHTML = '<p class="text-gray-400 text-sm">No sales yet.</p>';
  } else {
    topEl.innerHTML = ranked
      .map(
        (p) => `
      <div class="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
        <div>
          <h4 class="font-semibold text-gray-800">${p.name}</h4>
          <p class="text-sm text-gray-600">${p.units} sold</p>
        </div>
        <span class="text-green-600 font-bold">P${p.revenue.toFixed(2)}</span>
      </div>`
      )
      .join("");
  }
});

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
