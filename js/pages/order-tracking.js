// order-tracking.js
import { supabase } from "../core/supabase-client.js";

window.BSTM.ready().then(async function(session) {
  var wall    = document.getElementById("auth-wall");
  var content = document.getElementById("tracking-content");

  if (!session) {
    if (wall)    { wall.style.display = "flex"; }
    if (content) { content.style.display = "none"; }
    return;
  }

  if (wall)    { wall.style.display = "none"; }
  if (content) { content.style.display = "block"; }

  var userEl = document.getElementById("tracking-user");
  if (userEl) userEl.textContent = session.user.email;

  var container = document.getElementById("orders-list");
  if (!container) return;

  try {
    var { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error || !orders || orders.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:60px 20px;">'
        + '<div style="font-size:48px;margin-bottom:12px;">📦</div>'
        + '<p style="color:#9CA3AF;font-size:14px;margin-bottom:20px;">No orders yet.</p>'
        + '<a href="marketplace.html" style="background:linear-gradient(135deg,#7C3AED,#4F46E5);color:#fff;'
        + 'padding:12px 28px;border-radius:12px;font-weight:800;text-decoration:none;">Browse Mall →</a>'
        + '</div>';
      return;
    }

    var STATUS_COLORS = {
      pending:    { bg: "#FEF9C3", color: "#92400E" },
      confirmed:  { bg: "#DCFCE7", color: "#166534" },
      processing: { bg: "#DBEAFE", color: "#1E40AF" },
      shipped:    { bg: "#EDE9FE", color: "#5B21B6" },
      delivered:  { bg: "#D1FAE5", color: "#065F46" },
      cancelled:  { bg: "#FEE2E2", color: "#991B1B" }
    };

    container.innerHTML = orders.map(function(o) {
      var s = (o.status || "pending").toLowerCase();
      var sc = STATUS_COLORS[s] || STATUS_COLORS.pending;
      var date = new Date(o.created_at).toLocaleDateString("en-BW", { day:"numeric", month:"short", year:"numeric" });
      return '<div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid #EDE9FE;">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">'
        + '<div><div style="font-weight:900;color:#1E1B4B;font-size:15px;">Order #' + String(o.id).slice(-8).toUpperCase() + '</div>'
        + '<div style="font-size:12px;color:#9CA3AF;">' + date + '</div></div>'
        + '<span style="background:' + sc.bg + ';color:' + sc.color + ';padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;">'
        + s.toUpperCase() + '</span></div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;">'
        + '<div style="font-size:22px;font-weight:900;color:#7C3AED;">P' + Number(o.total_amount || 0).toFixed(2) + '</div>'
        + '<div style="font-size:12px;color:#059669;font-weight:700;">+' + (Number(o.total_amount||0)*0.015).toFixed(3) + ' THB</div>'
        + '</div></div>';
    }).join("");
  } catch(e) {
    console.error("Order tracking error:", e);
    if (container) container.innerHTML = '<p style="color:#9CA3AF;text-align:center;padding:40px;">Error loading orders.</p>';
  }
});

window.logout = function() { if (confirm("Logout?")) window.BSTM.logout(); };
