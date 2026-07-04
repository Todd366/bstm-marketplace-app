// AUDIT_IGNORE
// js/pages/notifications.js
window.BSTM.ready().then(function(session){

  if(!session) return;

  var badge=document.getElementById('notif-count');

  if(badge){
    badge.textContent='0';
  }

});

window.markAllRead=function(){

  document.querySelectorAll('.notif-item.unread')
    .forEach(function(el){
      el.classList.remove('unread');
    });

  var badge=document.getElementById('notif-count');

  if(badge){
    badge.textContent='0';
  }

};
