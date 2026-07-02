(function () {

  // ============================================
  // COMPONENT LOADER
  // ============================================
  function loadComponent(id, file, callback) {
    var el = document.getElementById(id);
    if (!el) return;

    fetch(file)
      .then(function (r) {
        if (!r.ok) throw new Error("Failed to load " + file);
        return r.text();
      })
      .then(function (html) {
        el.innerHTML = html;

        if (callback) callback();
      })
      .catch(function (e) {
        console.warn("Component load failed:", file, e);
      });
  }

  // ============================================
  // NAV BINDING (SAFE + NO DUPLICATES)
  // ============================================
  function bindNav() {

    const btn = document.getElementById("menu-btn");
    const menu = document.getElementById("mobile-menu");

    if (btn && menu && !btn.dataset.bound) {
      btn.dataset.bound = "1";

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        menu.style.display =
          menu.style.display === "block" ? "none" : "block";
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
  // INIT SYSTEM
  // ============================================
  function init() {

    loadComponent("bstm-nav", "components/nav.html", function () {
      bindNav();

      // Let app know nav is fully ready
      window.dispatchEvent(
        new CustomEvent("bstm:nav-ready", {
          detail: { source: "smart-loader" }
        })
      );
    });

    loadComponent("bstm-footer", "components/universal-footer.html");
  }

  // DOM READY
  document.addEventListener("DOMContentLoaded", init);

})();
