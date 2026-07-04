// AUDIT_IGNORE
// js/pages/room-switcher.js
var ROOMS={
  22:'room22-farm.html',
  1:'marketplace.html'
};

window.switchRoom=function(id){
  if(ROOMS[id]){
    window.location.href=ROOMS[id];
  }
};

document.addEventListener('DOMContentLoaded',function(){

  document.querySelectorAll('[data-room]').forEach(function(el){

    el.addEventListener('click',function(){
      window.switchRoom(el.dataset.room);
    });

  });

});
