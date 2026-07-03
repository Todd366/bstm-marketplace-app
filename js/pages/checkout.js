// checkout.js — prefill email from session, Paystack handled inline
window.BSTM.ready().then(function(session) {
  if (!session) { window.location.href = "login.html"; return; }
  var emailEl = document.getElementById("email");
  var nameEl  = document.getElementById("fullName");
  if (emailEl && !emailEl.value) emailEl.value = session.user.email;
  if (nameEl  && !nameEl.value)  nameEl.value  =
    session.user.user_metadata?.full_name || session.user.email.split("@")[0];

  // Load cart into order summary
  try {
    var cart = JSON.parse(localStorage.getItem("bstm_cart") || "[]");
    if (cart.length > 0) {
      var total = cart.reduce(function(s, i) { return s + (parseFloat(i.price?.replace("P","")) || 0) * (i.qty || 1); }, 0);
      var nameEl2 = document.getElementById("checkout-product-name");
      var metaEl  = document.getElementById("checkout-product-meta");
      var priceEl = document.getElementById("checkout-product-price");
      var subEl   = document.getElementById("checkout-subtotal");
      var commEl  = document.getElementById("checkout-commission");
      var thbEl   = document.getElementById("checkout-thb-reward");
      var totEl   = document.getElementById("checkout-total");
      if (nameEl2) nameEl2.textContent = cart.length === 1 ? cart[0].title : cart.length + " items";
      if (metaEl)  metaEl.textContent  = "Qty: " + cart.reduce(function(s,i){ return s+(i.qty||1); }, 0);
      if (priceEl) priceEl.textContent = "P" + total.toFixed(2);
      if (subEl)   subEl.textContent   = "P" + total.toFixed(2);
      if (commEl)  commEl.textContent  = "P" + (total * 0.05).toFixed(2);
      if (thbEl)   thbEl.textContent   = "+" + (total * 0.015).toFixed(3) + " THB";
      if (totEl)   totEl.textContent   = "P" + total.toFixed(2);
    }
  } catch(e) {}
});
window.logout = function() { if (confirm("Logout?")) window.BSTM.logout(); };
