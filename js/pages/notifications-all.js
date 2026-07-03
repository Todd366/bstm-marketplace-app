// notifications-all.js — logic lives inline in notifications-all.html
// This module only handles auth guard
window.BSTM.ready().then(function() {
  if (typeof loadNotifications === "function") loadNotifications();
});
