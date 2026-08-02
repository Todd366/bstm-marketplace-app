// AUDIT_IGNORE
// js/pages/order-success.js
document.addEventListener('DOMContentLoaded',function(){

  var n=document.getElementById('order-number');

  if(n){
    n.textContent='#BSTM-'+Math.floor(// REMOVED_DEMO_DATA()*900000000+100000000);
  }

  var cart=JSON.parse(localStorage.getItem('bstm_cart')||'[]');

  var total=cart.reduce(function(s,i){
    return s+(i.price||0);
  },0);

  var thb=(total*0.01).toFixed(2);

  ['order-total','order-total-display'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.textContent='P'+total.toFixed(2);
  });

  var earned=document.getElementById('thb-earned');
  if(earned) earned.textContent=thb;

  localStorage.removeItem('bstm_cart');
});


// ===== INLINE EXTRACTED (order-success.html) [2026-07-04 12:29] =====
// Get order ID from URL params if available
var params = new URLSearchParams(window.location.search);
var orderId = params.get('order') || ('BSTM-' + // REMOVED_DEMO_DATA().toString(36).substr(2,9).toUpperCase());
document.getElementById('order-number').textContent = '#' + orderId;
// ============================================


// ===== INLINE EXTRACTED (order-success.html) [2026-07-04 12:29] =====
let for your balance</div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <a href="order-tracking.html" style="flex:1;background:linear-gradient(135deg,#7C3AED,#4F46E5);color:#fff;padding:14px;border-radius:14px;font-weight:800;text-decoration:none;text-align:center;min-width:120px;">📦 Track Order</a>
      <a href="marketplace.html" style="flex:1;background:#F5F3FF;color:#7C3AED;padding:14px;border-radius:14px;font-weight:700;text-decoration:none;text-align:center;min-width:120px;">🏬 Keep Shopping</a>
    </div>
  </div>

  <div style="text-align:center;">
    <a href="buyer-dashboard.html" style="color:#9CA3AF;font-size:13px;text-decoration:none;">← Back to Dashboard</a>
  </div>
</div>

<div id="bstm-footer"></div>
// ============================================
