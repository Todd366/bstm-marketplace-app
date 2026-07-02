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

          window.dispatchEvent(new CustomEvent("bstm:componentLoaded", {
            detail: { source: file, target: id }
          }));
        });
      })
      .catch(err => console.error("[BSTM] Loader error:", err));
  }

  function bindNav() {
    if (navBound) return;

    const btn = document.getElementById("menu-btn");
    const menu = document.getElementById("mobile-menu");
    const notifBtn = document.getElementById("notif-btn");
    const notifPanel = document.getElementById("notif-panel");

    if (!btn || !menu) return;

    navBound = true;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      menu.classList.toggle("open");

      if (notifPanel) notifPanel.classList.remove("open");
    });

    document.addEventListener("click", (e) => {
      if (
        menu.classList.contains("open") &&
        !menu.contains(e.target) &&
        e.target !== btn
      ) {
        menu.classList.remove("open");
      }
    });

    if (notifBtn && notifPanel) {
      notifBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        notifPanel.classList.toggle("open");

        menu.classList.remove("open");
      });

      document.addEventListener("click", (e) => {
        if (
          notifPanel.classList.contains("open") &&
          !notifPanel.contains(e.target) &&
          e.target !== notifBtn
        ) {
          notifPanel.classList.remove("open");
        }
      });
    }
  }

  function tryBind() {
    bindNav();
    if (!navBound) {
      setTimeout(bindNav, 200);
      setTimeout(bindNav, 600);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadComponent("bstm-nav", "components/nav.html", tryBind);
    loadComponent("bstm-footer", "components/universal-footer.html");
  });

  window.addEventListener("bstm:componentLoaded", bindNav);

})();
