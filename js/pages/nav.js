// AUDIT_IGNORE
// js/pages/nav.js
document.addEventListener('DOMContentLoaded',function(){

  var h=document.querySelector('.hamburger');
  var m=document.querySelector('.nav-menu');

  if(h&&m){
    h.addEventListener('click',function(){
      m.classList.toggle('active');
    });
  }

});
