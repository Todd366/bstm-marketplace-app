// monitoring-dashboard.js
window.BSTM.ready().then(function(session) {
  var wall    = document.getElementById("auth-wall");
  var content = document.getElementById("monitoring-content");

  if (!session) {
    if (wall)    { wall.style.display = "flex"; }
    if (content) { content.style.display = "none"; }
    return;
  }

  if (wall)    { wall.style.display = "none"; }
  if (content) { content.style.display = "block"; }

  updateMetrics();
  setInterval(updateMetrics, 30000);
});

function updateMetrics() {
  var el = function(id) { return document.getElementById(id); };
  if (el("activeUsers"))  el("activeUsers").textContent  = Math.floor(Math.random() * 50 + 10);
  if (el("responseTime")) el("responseTime").textContent = Math.floor(Math.random() * 80 + 40) + " ms";
  if (el("lastUpdate"))   el("lastUpdate").textContent   = new Date().toLocaleTimeString();
}

window.logout = function() { if (confirm("Logout?")) window.BSTM.logout(); };
