(function () {

  function loadComponent(id, file, callback) {
    const el = document.getElementById(id);
    if (!el) return;

    fetch(file)
      .then(r => r.text())
      .then(html => {
        el.innerHTML = html;

        // HARD DELAY ensures DOM is fully ready on live hosting
        setTimeout(() => {
          if (callback) callback();
        }, 50);
      })
      .catch(err => console.warn("Component load failed:", file, err));
  }

  function bindNav() {

    const btn = document.getElementById("menu-btn");
    const menu = document.getElementById("mobile-menu");

    if (btn && menu) {

      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        menu.style.display = (menu.style.display === "block") ? "none" : "block";
      };

      document.addEventListener("click", (e) => {
        if (menu.style.display === "block" && !menu.contains(e.target)) {
          menu.style.display = "none";
        }
      });
    }

    const notifBtn = document.getElementById("notif-btn");
    const notifPanel = document.getElementById("notif-panel");

    if (notifBtn && notifPanel) {

      notifBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        notifPanel.style.display =
          notifPanel.style.display === "block" ? "none" : "block";
      };

      document.addEventListener("click", (e) => {
        if (notifPanel.style.display === "block" && !notifPanel.contains(e.target)) {
          notifPanel.style.display = "none";
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {

    loadComponent("bstm-nav", "components/nav.html", () => {
      bindNav();
    });

    loadComponent("bstm-footer", "components/universal-footer.html");

  });

})();
