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

        if (callback) callback();
      })
      .catch(err => {
        console.warn("Component load failed:", file, err);
      });
  }

  // ============================================
  // NAV BINDING (SAFE + NO DUPLICATES)
  // ============================================
  function bindNav() {

    const btn = document.getElementById("menu-btn");
    const menu = document.getElementById("mobile-menu");

    // 🔥 HAMBURGER TOGGLE
    if (btn && menu && !btn.dataset.bound) {
      btn.dataset.bound = "1";

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        menu.style.display =
          menu.style.display === "block" ? "none" : "block";
      });

      // close when clicking outside
      document.addEventListener("click", (e) => {
        if (menu.style.display === "block" && !menu.contains(e.target)) {
          menu.style.display = "none";
        }
      });
    }

    // 🔔 NOTIFICATIONS TOGGLE
    const notifBtn = document.getElementById("notif-btn");
    const notifPanel = document.getElementById("notif-panel");

    if (notifBtn && notifPanel && !notifBtn.dataset.bound) {
      notifBtn.dataset.bound = "1";

      notifBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        notifPanel.style.display =
          notifPanel.style.display === "block" ? "none" : "block";
      });

      document.addEventListener("click", (e) => {
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

    // NAV
    loadComponent("bstm-nav", "components/nav.html", function () {
      bindNav();

      // signal app is ready
      window.dispatchEvent(
        new CustomEvent("bstm:ready", {
          detail: { source: "smart-loader" }
        })
      );
    });

    // FOOTER
    loadComponent("bstm-footer", "components/universal-footer.html");

  });

})();
