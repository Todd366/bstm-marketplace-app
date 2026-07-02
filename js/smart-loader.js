(function () {

  // ==============================
  // COMPONENT LOADER
  // ==============================
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
        if (callback) callback();
      })
      .catch(err => {
        console.warn("Component load error:", file, err);
      });
  }

  // ==============================
  // NAV BINDING (SAFE + NO DUPLICATES)
  // ==============================
  function bindNav() {

    // MOBILE MENU TOGGLE
    const menuBtn = document.getElementById("menu-btn");
    const mobileMenu = document.getElementById("mobile-menu");

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

    // NOTIFICATION PANEL
    const notifBtn = document.getElementById("notif-btn");
    const notifPanel = document.getElementById("notif-panel");

    if (notifBtn && notifPanel && !notifBtn.dataset.bound) {
      notifBtn.dataset.bound = "1";

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

  // ==============================
  // INIT
  // ==============================
  document.addEventListener("DOMContentLoaded", function () {

    // Load NAVBAR
    loadComponent("bstm-nav", "components/nav.html", function () {
      bindNav();

      // signal to other scripts (important for app.js)
      window.dispatchEvent(new CustomEvent("bstm:ready"));
    });

    // Load FOOTER
    loadComponent("bstm-footer", "components/universal-footer.html");

  });

})();
