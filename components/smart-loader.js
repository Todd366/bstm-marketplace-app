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

  // ---- nav helpers: cart count, current-page highlight, dropdown closing ----
  function cartCount() {
    try {
      const cart = JSON.parse(localStorage.getItem("bstm_cart") || "[]");
      return Array.isArray(cart) ? cart.reduce((n, i) => n + (Number(i && i.qty) || 0), 0) : 0;
    } catch (e) {
      return 0;
    }
  }

  function updateCartCount() {
    const n = cartCount();
    document.querySelectorAll(".nav-cart-count").forEach((el) => {
      el.textContent = n > 99 ? "99+" : String(n);
      el.hidden = n <= 0;
    });
  }

  function markActiveLinks() {
    const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    document.querySelectorAll("#bstm-nav-bar a[href]").forEach((a) => {
      const target = (a.getAttribute("href") || "").split("?")[0].split("#")[0].toLowerCase();
      if (target && target === here) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "page");
        const group = a.closest(".nav-group");
        if (group) group.querySelector("summary").classList.add("is-active");
      }
    });
  }

  let groupsBound = false;
  function bindGroups() {
    if (groupsBound) return;
    groupsBound = true;
    document.addEventListener("click", (e) => {
      document.querySelectorAll(".nav-group[open]").forEach((g) => {
        if (!g.contains(e.target)) g.open = false;
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".nav-group[open]").forEach((g) => { g.open = false; });
    });
  }

  window.addEventListener("bstm:cartUpdated", updateCartCount);
  window.addEventListener("storage", updateCartCount);

  function bindNav() {
    if (navBound) return;

    const btn = document.getElementById("menu-btn");
    const menu = document.getElementById("mobile-menu");
    const notifBtn = document.getElementById("notif-btn");
    const notifPanel = document.getElementById("notif-panel");

    if (!btn || !menu) return;

    navBound = true;
    updateCartCount();
    markActiveLinks();
    bindGroups();

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

    const userDropdown = document.getElementById("nav-user-dropdown");
    const userNameBtn = document.getElementById("nav-user-name");
    if (userDropdown && userNameBtn) {
      document.addEventListener("click", (e) => {
        if (
          userDropdown.classList.contains("open") &&
          !userDropdown.contains(e.target) &&
          e.target !== userNameBtn
        ) {
          userDropdown.classList.remove("open");
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
