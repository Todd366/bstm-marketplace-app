(function () {

  function loadComponent(id, file, callback) {
    const el = document.getElementById(id);
    if (!el) return;

    fetch(file + "?v=" + Date.now()) // 🔥 cache bust FIX
      .then(r => {
        if (!r.ok) throw new Error("Failed: " + file);
        return r.text();
      })
      .then(html => {
        el.innerHTML = html;

        requestAnimationFrame(() => {
          if (callback) callback();
        });
      })
      .catch(err => {
        console.error("[BSTM] Load error:", file, err);
      });
  }

  function bindNav() {

    const menuBtn = document.getElementById("menu-btn");
    const mobileMenu = document.getElementById("mobile-menu");

    if (menuBtn && mobileMenu && !menuBtn.dataset.bound) {
      menuBtn.dataset.bound = "1";

      menuBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        mobileMenu.style.display =
          mobileMenu.style.display === "block" ? "none" : "block";
      });

      document.addEventListener("click", (e) => {
        if (mobileMenu.style.display === "block" &&
            !mobileMenu.contains(e.target) &&
            e.target !== menuBtn) {
          mobileMenu.style.display = "none";
        }
      });
    }

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
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadComponent("bstm-nav", "components/nav.html", bindNav);
    loadComponent("bstm-footer", "components/universal-footer.html", bindNav);
  });

})();
