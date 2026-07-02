// ============================================
// BSTM CABLINK PAGE SCRIPT
// ============================================

(function () {

  function initCabLink() {

    console.log("[BSTM] CabLink loaded");

    // Example: future booking hooks
    const bookBtns = document.querySelectorAll("[data-book-ride]");
    bookBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        alert("🚗 Ride booking coming soon in CabLink");
      });
    });

    // Optional: quick UI state handling
    const rideCards = document.querySelectorAll(".ride-card");
    rideCards.forEach(card => {
      card.addEventListener("click", () => {
        card.classList.toggle("active");
      });
    });

  }

  document.addEventListener("DOMContentLoaded", initCabLink);
  window.addEventListener("bstm:ready", initCabLink);

})();
