// js/pages/gov-dashboard.js
import { getProfile } from "../bstm-core.js";
import { supabase } from "../core/supabase-client.js";

window.BSTM.ready().then(async function (session) {
  if (!session) {
    window.location.href = "login.html?redirect=gov-dashboard.html";
    return;
  }

  const { data: profile } = await getProfile(session.user.id);

  if (!profile || !["admin", "government"].includes(profile.role)) {
    alert("This dashboard is restricted to BSTM staff.");
    window.location.href = "buyer-dashboard.html";
    return;
  }

  document.querySelectorAll(".gov-user, #userName").forEach((el) => {
    el.textContent = session.user.email.split("@")[0];
  });

  // Total users
  const { count: userCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
  document.getElementById("stat-total-users").textContent = userCount ?? "—";

  // Pending KYC
  const { count: kycCount } = await supabase
    .from("kyc_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  document.getElementById("stat-pending-kyc").textContent = kycCount ?? "—";

  // All products
  const { count: productCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });
  document.getElementById("stat-all-products").textContent = productCount ?? "—";

  // Platform revenue — sum of all order_items across every seller
  const { data: items } = await supabase
    .from("order_items")
    .select("quantity, unit_price");
  const revenue = (items || []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  document.getElementById("stat-platform-revenue").textContent = `P${revenue.toFixed(2)}`;
});

window.handleLogout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
