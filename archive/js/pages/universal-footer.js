// ============================================
// BSTM UNIVERSAL FOOTER LOADER
// ============================================

(function () {

  function loadFooter() {
    const el = document.getElementById("bstm-footer");
    if (!el) return;

    fetch("components/universal-footer.html")
      .then(r => {
        if (!r.ok) throw new Error("Footer not found");
        return r.text();
      })
      .then(html => {
        el.innerHTML = html;
      })
      .catch(err => {
        console.error("[BSTM] Footer load failed:", err);
      });
  }

  document.addEventListener("DOMContentLoaded", loadFooter);

  // re-run after nav smart-loader finishes
  window.addEventListener("bstm:ready", loadFooter);

})();
