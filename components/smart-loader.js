(function() {
  function loadComponent(id, file, callback) {
    var el = document.getElementById(id);
    if (!el) return;
    fetch(file)
      .then(function(r) { return r.text(); })
      .then(function(html) {
        el.innerHTML = html;
        if (callback) callback();
      })
      .catch(function(e) { console.warn("Could not load " + file, e); });
  }

  document.addEventListener("DOMContentLoaded", function() {
    loadComponent("bstm-nav", "components/nav.html", function() {
      // Hamburger — wire after nav is injected into DOM
      var btn = document.getElementById("menu-btn");
      var menu = document.getElementById("mobile-menu");
      if (btn && menu) {
        btn.addEventListener("click", function(e) {
          e.stopPropagation();
          menu.style.display = menu.style.display === "block" ? "none" : "block";
        });
        document.addEventListener("click", function(e) {
          if (!menu.contains(e.target) && e.target !== btn) {
            menu.style.display = "none";
          }
        });
      }

      // Notification bell
      var notifBtn = document.getElementById("notif-btn");
      var notifPanel = document.getElementById("notif-panel");
      if (notifBtn && notifPanel) {
        notifBtn.addEventListener("click", function(e) {
          e.stopPropagation();
          notifPanel.style.display = notifPanel.style.display === "none" ? "block" : "none";
        });
        document.addEventListener("click", function(e) {
          if (notifPanel && !notifPanel.contains(e.target) && e.target !== notifBtn) {
            notifPanel.style.display = "none";
          }
        });
      }
    });

    loadComponent("bstm-footer", "components/universal-footer.html");
  });
})();
