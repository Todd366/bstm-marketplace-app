(function () {

  // ============================================
  // COMPONENT LOADER (SAFE)
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

        // wait 1 tick so DOM is fully painted
        requestAnimationFrame(() => {
          if (callback) callback();
        });
      })
      .catch(err => {
        console.warn("Component load failed:", file, err);
      });
  }

  // ============================================
  // NAV BINDING (HAMBURGER + NOTIFICATIONS)
  // ============================================
  function bindNav() {

    const btn = document.getElementById("menu-btn");
    const menu = document.getElementById("mobile-menu");

    const notifBtn = document.getElementById("notif-btn");
    const notifPanel = document.getElementById("notif-panel");

    // Prevent double-binding even across reloads
    if (btn && menu && !btn.dataset.bound) {
      btn.dataset.bound = "1";

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const isOpen = menu.style.display === "block";
        menu.style.display = isOpen ? "none" : "block";
      });

      document.addEventListener("click", function (e) {
        if (
          menu.style.display === "block" &&
          !menu.contains(e.target) &&
          e.target !== btn
        ) {
          menu.style.display = "none";
        }
      });
    }

    if (notifBtn && notifPanel && !notifBtn.dataset.bound) {
      notifBtn.dataset.bound = "1";

      notifBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const isOpen = notifPanel.style.display === "block";
        notifPanel.style.display = isOpen ? "none" : "block";
      });

      document.addEventListener("click", function (e) {
        if (
          notifPanel &&
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

    loadComponent("bstm-nav", "components/nav.html", function () {

      bindNav();

      // global event so other scripts can hook in safely
      window.dispatchEvent(
        new CustomEvent("bstm:ready", {
          detail: {
            source: "smart-loader",
            nav: true
          }
        })
      );

    });

    loadComponent("bstm-footer", "components/universal-footer.html");

  });

})();
