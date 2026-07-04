export function renderShell() {
  const nav = document.getElementById("bstm-nav");
  const footer = document.getElementById("bstm-footer");

  if (nav) nav.innerHTML = "🏪 BSTM Marketplace";
  if (footer) footer.innerHTML = "© BSTM Marketplace";
}
