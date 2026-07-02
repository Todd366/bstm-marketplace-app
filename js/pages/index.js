// ============================================
// INDEX PAGE LOGIC (SAFE DEFAULT)
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("[BSTM] index.js loaded");

  // wait for nav/footer injection system
  window.addEventListener("bstm:ready", () => {
    console.log("[BSTM] UI ready (index)");
  });
});
