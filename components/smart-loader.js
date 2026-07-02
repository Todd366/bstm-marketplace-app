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

          // Dispatch once per successful load (lightweight signal only)
          window.dispatchEvent(new CustomEvent("bstm:componentLoaded", {
            detail: { source: file, target: id }
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

        menu.classList.toggle("open");
      });

      document.addEventListener("click", (e) => {
        if (menu.classList.contains("open") &&
            !menu.contains(e.target) &&
            e.target !== btn) {
          menu.classList.remove("open");
        }
      });
    }

    const notifBtn = document.getElementById("notif-btn");
    const notifPanel = document.getElementById("notif-panel");

    if (notifBtn && notifPanel) {
      notifBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        notifPanel.classList.toggle("open");
      });

      document.addEventListener("click", (e) => {
        if (notifPanel.classList.contains("open") &&
            !notifPanel.contains(e.target)) {
          notifPanel.classList.remove("open");
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadComponent("bstm-nav", "components/nav.html", bindNav);
    loadComponent("bstm-footer", "components/universal-footer.html");
  });

  // Safe rebind (only once)
  window.addEventListener("bstm:componentLoaded", bindNav);

})();
