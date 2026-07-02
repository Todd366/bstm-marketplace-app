// ============================================
// BSTM NAV FIXER (CRITICAL PATCH)
// Fixes hamburger + notif + mobile menu after fetch injection
// ============================================

function bindNavEvents() {
  const btn = document.getElementById("menu-btn");
  const menu = document.getElementById("mobile-menu");

  if (btn && menu && !btn.dataset.bound) {
    btn.dataset.bound = "true";

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.style.display = "none";
      }
    });
  }

  const notifBtn = document.getElementById("notif-btn");
  const notifPanel = document.getElementById("notif-panel");

  if (notifBtn && notifPanel && !notifBtn.dataset.bound) {
    notifBtn.dataset.bound = "true";

    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      notifPanel.style.display =
        notifPanel.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
      if (notifPanel && !notifPanel.contains(e.target) && e.target !== notifBtn) {
        notifPanel.style.display = "none";
      }
    });
  }
}

// Run immediately
document.addEventListener("DOMContentLoaded", bindNavEvents);

// ALSO re-run after dynamic injection (THIS is your homepage fix)
window.addEventListener("bstm:ready", bindNavEvents);
