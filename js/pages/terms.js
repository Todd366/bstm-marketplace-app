// terms.js — showTab() defined inline in terms.html
document.addEventListener("DOMContentLoaded", function() {
  if (typeof showTab === "function") showTab("terms");
  // Handle URL hash
  if (window.location.hash === "#privacy" && typeof showTab === "function") showTab("privacy");
});
