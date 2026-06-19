export function on(selector, event, handler) {
  document.addEventListener(event, (e) => {
    if (e.target.closest(selector)) {
      handler(e);
    }
  });
}
