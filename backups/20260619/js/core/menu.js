export function initMenu() {
  document.querySelectorAll(".menu-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sidebar").forEach(sidebar => {
        sidebar.classList.toggle("open");
      });
    });
  });
}
