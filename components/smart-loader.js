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
        console.warn("Could not load " + file, e);
      });
  }

  // ============================================
  // SAFE EVENT BINDING (NO DUPLICATES EVER)
  // ============================================
  function bindNav() {

    const btn = document.getElementById("menu-btn");
    const menu = document.getElementById("mobile-menu");

    if (btn && menu && !btn.dataset.bound) {
      btn.dataset.bound = "1";

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const isOpen = menu.style.display === "block";
        menu.style.display = isOpen ? "none" : "block";
      });

      document.addEventListener("click", function (e) {
        if (menu.style.display === "block") {
          if (!menu.contains(e.target) && e.target !== btn) {
            menu.style.display = "none";
          }
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

      // IMPORTANT: delay ready event slightly so DOM is stable
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("bstm:ready", {
            detail: { source: "smart-loader" }
          })
        );
      }, 0);

    });

    loadComponent("bstm-footer", "components/universal-footer.html");

  });

})();
