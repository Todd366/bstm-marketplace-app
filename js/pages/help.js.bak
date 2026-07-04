// help.js — toggleFaq and scrollToSection defined inline in help.html
document.addEventListener("DOMContentLoaded", function() {
  // Search wiring (backup in case inline script missed it)
  var input = document.getElementById("help-search");
  if (input && !input.dataset.wired) {
    input.dataset.wired = "1";
    input.addEventListener("input", function() {
      var q = this.value.trim().toLowerCase();
      document.querySelectorAll(".faq-item").forEach(function(item) {
        item.style.display = !q || item.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });
  }
});
