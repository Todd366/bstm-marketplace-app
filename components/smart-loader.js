(function () {

  // ============================================
  // COMPONENT LOADER
  // ============================================
  function loadComponent(id, file, callback) {
    const el = document.getElementById(id);
    if (!el) return;

    fetch(file)
      .then(response => {
        if (!response.ok) {
          throw new Error("Failed to load " + file);
        }
        return response.text();
      })
      .then(html => {
        el.innerHTML = html;

        // Wait one frame so the inserted HTML exists
        requestAnimationFrame(() => {
          if (typeof callback === "function") {
            callback();
          }
        });
      })
      .catch(error => {
        console.error("[BSTM] Component load failed:", file, error);
      });
  }

  // ============================================
  // NAVIGATION
  // ============================================
  function bindNav() {

    const menuBtn = document.getElementById("menu-btn");
    const mobileMenu = document.getElementById("mobile-menu");

    if (menuBtn && mobileMenu && !menuBtn.dataset.bound) {

      menuBtn.dataset.bound = "true";

      menuBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        mobileMenu.style.display =
          mobileMenu.style.display === "block"
            ? "none"
            : "block";
      });

      document.addEventListener("click", function (e) {

        if (
          mobileMenu.style.display === "block" &&
          !mobileMenu.contains(e.target) &&
          e.target !== menuBtn
        ) {
          mobileMenu.style.display = "none";
        }

      });

    }

    // ============================================
    // NOTIFICATIONS
    // ============================================

    const notifBtn = document.getElementById("notif-btn");
    const notifPanel = document.getElementById("notif-panel");

    if (notifBtn && notifPanel && !notifBtn.dataset.bound) {

      notifBtn.dataset.bound = "true";

      notifBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        notifPanel.style.display =
          notifPanel.style.display === "block"
            ? "none"
            : "block";
      });

      document.addEventListener("click", function (e) {

        if (
          notifPanel.style.display === "block" &&
          !notifPanel.contains(e.target) &&
          e.target !== notifBtn
        ) {
          notifPanel.style.display = "none";
        }

      });

    }

  }

  // ============================================
  // INITIALIZE
  // ============================================
  document.addEventListener("DOMContentLoaded", function () {

    loadComponent(
      "bstm-nav",
      "components/nav.html",
      function () {

        bindNav();

        window.dispatchEvent(
          new CustomEvent("bstm:ready", {
            detail: {
              source: "smart-loader"
            }
          })
        );

      }
    );

    loadComponent(
      "bstm-footer",
      "components/universal-footer.html"
    );

  });

})();
