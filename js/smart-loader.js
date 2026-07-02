(function () {

  // ============================================
  // COMPONENT LOADER
  // ============================================
  function loadComponent(id, file, callback) {
    const el = document.getElementById(id);
    if (!el) return;

    fetch(file)
      .then(r => {
        if (!r.ok) throw new Error("Failed to load " + file);
        return r.text();
      })
      .then(html => {
        el.innerHTML = html;

        // ensure DOM is ready after injection
        requestAnimationFrame(() => {
          if (typeof callback === "function") callback();
        });
      })
      .catch(err => {
        console.error("[BSTM] Failed loading:", file, err);
      });
  }

  // ============================================
  // NAV BEHAVIOR (HAMBURGER + NOTIFICATIONS)
  // ============================================
  function bindNav() {

    const menuBtn = document.getElementById("menu-btn");
    const mobileMenu = document.getElementById("mobile-menu");

    const notifBtn = document.getElementById("notif-btn");
    const notifPanel = document.getElementById("notif-panel");

    // ----------------------------
    // HAMBURGER MENU
    // ----------------------------
    if (menuBtn && mobileMenu && !menuBtn.dataset.bound) {

      menuBtn.dataset.bound = "1";

      menuBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        mobileMenu.style.display =
          mobileMenu.style.display === "block" ? "none" : "block";
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

    // ----------------------------
    // NOTIFICATIONS PANEL
    // ----------------------------
    if (notifBtn && notifPanel && !notifBtn.dataset.boundNotif) {

      notifBtn.dataset.boundNotif = "1";

      notifBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        notifPanel.style.display =
          notifPanel.style.display === "block" ? "none" : "block";
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
  // INIT
  // ============================================
  document.addEventListener("DOMContentLoaded", function () {

    loadComponent("bstm-nav", "components/nav.html", bindNav);

    loadComponent("bstm-footer", "components/universal-footer.html");

    window.dispatchEvent(
      new CustomEvent("bstm:ready", {
        detail: { source: "smart-loader" }
      })
    );

  });

})();
