// thb-wallet.js
import { supabase } from "../core/supabase-client.js";

// Use event to avoid race condition with app.js module loading
window.addEventListener('bstm:ready', async function(e) {
  var session = e.detail;
  var wall    = document.getElementById("auth-wall");
  var content = document.getElementById("wallet-content");

  if (!session) {
    if (wall)    { wall.style.display = "flex"; }
    if (content) { content.style.display = "none"; }
    return;
  }

  if (wall)    { wall.style.display = "none"; }
  if (content) { content.style.display = "block"; }

  var email = session.user.email;
  var name  = session.user.user_metadata?.full_name || email.split("@")[0];

  document.querySelectorAll(".wallet-user-name").forEach(function(el) { el.textContent = name; });
  document.querySelectorAll(".wallet-user-email").forEach(function(el) { el.textContent = email; });

  // Generate deterministic wallet address from user id
  var uid = session.user.id.replace(/-/g, "");
  var addr = "0x" + uid.substring(0, 40);
  var addrEl = document.getElementById("walletAddress");
  if (addrEl) addrEl.textContent = addr;

  // Generate referral code
  var codeEl = document.getElementById("referralCode");
  if (codeEl) codeEl.textContent = "BSTM-" + uid.substring(0, 4).toUpperCase();

  // Load orders for THB calculation
  try {
    var { data: orders } = await supabase
      .from("orders")
      .select("total_amount, created_at")
      .eq("user_id", session.user.id);

    orders = orders || [];

    var lifetimeTHB = orders.reduce(function(sum, o) {
      return sum + (parseFloat(o.total_amount) || 0) * 0.015;
    }, 0);

    var now = new Date();
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var monthTHB = orders
      .filter(function(o) { return new Date(o.created_at) >= monthStart; })
      .reduce(function(sum, o) { return sum + (parseFloat(o.total_amount) || 0) * 0.015; }, 0);

    var el = function(id) { return document.getElementById(id); };
    if (el("walletTHBBalance"))   el("walletTHBBalance").textContent   = lifetimeTHB.toFixed(3);
    if (el("walletBWPEquivalent"))el("walletBWPEquivalent").textContent= (lifetimeTHB * 10).toFixed(2);
    if (el("monthlyEarned"))      el("monthlyEarned").textContent      = monthTHB.toFixed(1);
    if (el("lifetimeEarned"))     el("lifetimeEarned").textContent     = lifetimeTHB.toFixed(1);
    if (el("order-count"))        el("order-count").textContent        = orders.length;

    // Render transaction list
    var listEl = el("transactionsList");
    if (listEl && orders.length > 0) {
      listEl.innerHTML = orders.map(function(o) {
        var thb = ((parseFloat(o.total_amount) || 0) * 0.015).toFixed(3);
        var date = new Date(o.created_at).toLocaleDateString();
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #F3F4F6;">'
          + '<div><div style="font-weight:700;color:#1E1B4B;font-size:14px;">Purchase Reward</div>'
          + '<div style="font-size:12px;color:#9CA3AF;">' + date + '</div></div>'
          + '<div style="font-weight:900;color:#059669;font-size:15px;">+' + thb + ' THB</div>'
          + '</div>';
      }).join("");
    }
  } catch(e) {
    console.error("Wallet load error:", e);
  }
});

window.logout = function() { if (confirm("Logout?")) window.BSTM.logout(); };
