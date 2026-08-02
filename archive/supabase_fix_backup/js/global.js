window.BSTM_BOOTSTRAPPED = window.BSTM_BOOTSTRAPPED || false;

if (window.BSTM_BOOTSTRAPPED) {
  console.warn("BSTM already bootstrapped — skipping duplicate init");
} else {
  window.BSTM_BOOTSTRAPPED = true;
}
window.BSTM = window.BSTM || {};
window.BSTM.initOnce = window.BSTM.initOnce || new Set();

document.addEventListener("componentLoaded", (e) => {
  // Only run once per session
  if (window.BSTM.initOnce.has("menu-toggle")) return;
  window.BSTM.initOnce.add("menu-toggle");

  const bindMenu = () => {
    const btn = document.querySelector(".menu-btn");
    const sidebar = document.querySelector(".sidebar");

    if (!btn || !sidebar) return;

    btn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  };

  bindMenu();
});
