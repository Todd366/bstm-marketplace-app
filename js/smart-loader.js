(function () {

  function loadComponent(id, file, callback) {
    const el = document.getElementById(id);
    if (!el) return;

    fetch(file + "?v=" + Date.now())
      .then(r => r.text())
      .then(html => {
        el.innerHTML = html;
        if (typeof callback === "function") {
          requestAnimationFrame(callback);
        }
      })
      .catch(err => console.error("[smart-loader] error:", err));
  }

  function bindNav() {
    const btn = document.getElementById("menu-btn");
    const menu = document.getElementById("mobile-menu");

    if (btn && menu && !btn.dataset.bound) {
      btn.dataset.bound = "1";

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.style.display = menu.style.display === "block" ? "none" : "block";
      });

      document.addEventListener("click", (e) => {
        if (menu.style.display === "block" && !menu.contains(e.target)) {
          menu.style.display = "none";
        }
      });
    }

    const notifBtn = document.getElementById("notif-btn");
    const notifPanel = document.getElementById("notif-panel");

    if (notifBtn && notifPanel && !notifBtn.dataset.boundNotif) {
      notifBtn.dataset.boundNotif = "1";

      notifBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        notifPanel.style.display =
          notifPanel.style.display === "block" ? "none" : "block";
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadComponent("bstm-nav", "components/nav.html", bindNav);
    loadComponent("bstm-footer", "components/universal-footer.html");
    window.dispatchEvent(new Event("bstm:ready"));
  });

})();
