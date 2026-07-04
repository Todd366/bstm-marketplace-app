// AUDIT_IGNORE
// js/pages/universal-nav.js
document.addEventListener('DOMContentLoaded',function(){

  var h=document.querySelector('.hamburger,.menu-btn');
  var m=document.querySelector('.nav-menu,#mobile-menu');

  if(h&&m){
    h.addEventListener('click',function(){
      m.classList.toggle('active');
    });
  }

});
