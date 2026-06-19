(function() {
  function loadComponent(id, file, callback) {
    var el = document.getElementById(id);
    if (!el) return;
    fetch(file)
      .then(function(r) { return r.text(); })
      .then(function(html) {
        el.innerHTML = html;
        var scripts = el.querySelectorAll("script");
        scripts.forEach(function(s) {
          var ns = document.createElement("script");
          ns.textContent = s.textContent;
          document.body.appendChild(ns);
        });
        if (callback) callback();
      })
      .catch(function(e) { console.warn("Could not load " + file, e); });
  }

  document.addEventListener("DOMContentLoaded", function() {
    loadComponent("bstm-nav", "components/nav.html");
    loadComponent("bstm-footer", "components/universal-footer.html");
  });
})();
