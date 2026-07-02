(function () {

  let navBound = false;

  function loadComponent(id, file, callback) {
    const el = document.getElementById(id);
    if (!el) return;

    fetch(file + "?v=" + Date.now())
      .then(r => {
        if (!r.ok) throw new Error("Failed: " + file);
        return r.text();
      })
      .then(html => {
        el.innerHTML = html;

        requestAnimationFrame(() => {
          if (callback) callback();

          // safe single dispatch (no duplicates spam)
          window.dispatchEvent(new CustomEvent("bstm:ready", {
            detail: { source: file }
          }));
        });
      })
      .catch(err => console.error("[BSTM] Loader error:", err));
  }

  function bindNav() {
    if (navBound) return;
    navBound = true;

    const btn = document.getElementById("menu-btn");
    const menu = document.getElementById("mobile-menu");

    if (btn && menu) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        menu.style.display =
          menu.style.display === "block" ? "none" : "block";
      });

      document.addEventListener("click", (e) => {
        if (menu.style.display === "block" && !menu.contains(e.target) && e.target !== btn) {
          menu.style.display = "none";
        }
      });
    }

    const notifBtn = document.getElementById("notif-btn");
    const notifPanel = document.getElementById("notif-panel");

    if (notifBtn && notifPanel) {
      notifBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        notifPanel.style.display =
          notifPanel.style.display === "block" ? "none" : "block";
      });

      document.addEventListener("click", (e) => {
        if (notifPanel.style.display === "block" && !notifPanel.contains(e.target)) {
          notifPanel.style.display = "none";
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadComponent("bstm-nav", "components/nav.html", bindNav);
    loadComponent("bstm-footer", "components/universal-footer.html", null);
  });

  // re-bind after any re-render / SPA injection
  window.addEventListener("bstm:ready", bindNav);

})();
