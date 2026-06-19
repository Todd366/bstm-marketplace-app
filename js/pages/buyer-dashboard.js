import { supabase } from "../core/supabase-client.js";
import { getProfile } from "../bstm-core.js";

document.addEventListener("DOMContentLoaded", async function() {
  var { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    document.getElementById("auth-wall").style.display = "flex";
    document.getElementById("dashboard-content").style.display = "none";
    return;
  }

  var user = session.user;
  document.getElementById("dashboard-content").style.display = "block";
  document.getElementById("auth-wall").style.display = "none";
  document.getElementById("user-name").textContent = user.email.split("@")[0];
  document.getElementById("user-email").textContent = user.email;

  var { data: profile } = await getProfile(user.id);
  if (profile) {
    if (document.getElementById("stat-thb"))
      document.getElementById("stat-thb").textContent = (profile.thb_balance || 0).toFixed(2) + " THB";
    if (document.getElementById("stat-orders"))
      document.getElementById("stat-orders").textContent = profile.total_orders || 0;
    if (document.getElementById("stat-referral"))
      document.getElementById("stat-referral").textContent = profile.referral_code || "N/A";
    if (document.getElementById("ref-code-display"))
      document.getElementById("ref-code-display").textContent = profile.referral_code || "N/A";
  }
});

window.logout = async function() {
  if (confirm("Are you sure you want to logout?")) {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  }
};

window.copyReferral = async function() {
  var { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  var { data: profile } = await getProfile(session.user.id);
  var code = profile?.referral_code || "";
  var link = "https://todd366.github.io/bstm-marketplace-app/?ref=" + code;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(function() { alert("✅ Referral link copied!"); });
  } else {
    alert("Your referral link: " + link);
  }
};
