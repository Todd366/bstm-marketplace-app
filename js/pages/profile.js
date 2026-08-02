// AUDIT_IGNORE
// js/pages/profile.js
window.BSTM.ready().then(function(session){
  if(!session){
    window.location.href='login.html';
    return;
  }

  var u=session.user;

  var n=document.getElementById('profile-name');
  var e=document.getElementById('profile-email');
  var a=document.getElementById('profile-avatar');

  if(n) n.textContent=u.email.split('@')[0];
  if(e) e.textContent=u.email;
  if(a) a.textContent=u.email.charAt(0).toUpperCase();
});

window.logout=function(){
  if(confirm('Logout?')){
    window.BSTM.logout();
  }
};
