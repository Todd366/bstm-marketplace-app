// js/pages/earnings.js
import { getProfile } from "../bstm-core.js";
import { supabase } from "../core/supabase-client.js";

window.BSTM.ready().then(async function (session) {
  if (!session) {
    document.getElementById("auth-wall").style.display = "block";
    return;
  }
  document.getElementById("earnings-content").style.display = "block";

  const userId = session.user.id;

  const { data: profile } = await getProfile(userId);
  if (profile) {
    document.getElementById("thb-balance").textContent = (profile.thb_balance || 0).toFixed(2);
  }

  const { data: myProducts } = await supabase
    .from("products")
    .select("id")
    .eq("seller_id", userId);

  const productIds = (myProducts || []).map((p) => p.id);

  if (productIds.length === 0) {
    document.getElementById("total-earnings").textContent = "0.00";
    document.getElementById("products-sold").textContent = "0";
    document.getElementById("commission-paid").textContent = "P0.00";
    return;
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("quantity, unit_price")
    .in("product_id", productIds);

  const rows = items || [];
  const totalRevenue = rows.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const unitsSold = rows.reduce((sum, i) => sum + i.quantity, 0);

  document.getElementById("total-earnings").textContent = totalRevenue.toFixed(2);
  document.getElementById("products-sold").textContent = unitsSold;

  // No platform commission is deducted anywhere in the checkout flow yet —
  // showing a fabricated fee here would misrepresent real earnings.
  document.getElementById("commission-paid").textContent = "P0.00";
});

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
