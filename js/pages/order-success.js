// AUDIT_IGNORE
// js/pages/order-success.js
document.addEventListener('DOMContentLoaded',function(){

  var n=document.getElementById('order-number');

  if(n){
    n.textContent='#BSTM-'+Math.floor(Math.random()*900000000+100000000);
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
var orderId = params.get('order') || ('BSTM-' + Math.random().toString(36).substr(2,9).toUpperCase());
document.getElementById('order-number').textContent = '#' + orderId;
// ============================================
