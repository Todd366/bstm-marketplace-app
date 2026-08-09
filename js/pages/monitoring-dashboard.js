// js/pages/monitoring-dashboard.js
import { supabase } from "../core/supabase-client.js";
import { getProfile } from "../bstm-core.js";

function setDot(id, healthy) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("bg-green-500", "bg-red-500");
  el.classList.add(healthy ? "bg-green-500" : "bg-red-500");
}

async function checkHealth() {
  const start = performance.now();
  const { error } = await supabase.from("products").select("id").limit(1);
  const latency = Math.round(performance.now() - start);

  const dbHealthy = !error;
  document.getElementById("responseTime").textContent = dbHealthy ? `${latency}ms` : "—";
  setDot("dbStatus", dbHealthy);
  setDot("websiteStatus", true); // tautological — if this script ran, the site loaded
  setDot("apiStatus", dbHealthy); // Supabase is the only real backend API in use
  setDot("paymentsStatus", false); // Paystack still on placeholder key — honestly red until configured

  const log = document.getElementById("errorLog");
  const entries = [];
  if (!dbHealthy) entries.push(`<p class="text-red-400 text-sm">⚠ Database query failed: ${error.message}</p>`);
  entries.push('<p class="text-yellow-400 text-sm">⚠ Paystack not configured — payments are disabled</p>');
  log.innerHTML = entries.join("");

  const lastUpdate = document.getElementById("lastUpdate");
  if (lastUpdate) lastUpdate.textContent = "Last updated: " + new Date().toLocaleTimeString();
}

window.BSTM.ready().then(async function (session) {
  const wall = document.getElementById("auth-wall");
  const content = document.getElementById("monitoring-content");

  if (!session) {
    if (wall) wall.style.display = "flex";
    if (content) content.style.display = "none";
    return;
  }

  const { data: profile } = await getProfile(session.user.id);
  if (!profile || !["admin", "government"].includes(profile.role)) {
    alert("This dashboard is restricted to BSTM staff.");
    window.location.href = "buyer-dashboard.html";
    return;
  }

  if (wall) wall.style.display = "none";
  if (content) content.style.display = "block";

  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
  document.getElementById("activeUsers").textContent = count ?? "—";

  await checkHealth();
  setInterval(checkHealth, 30000);
});

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
