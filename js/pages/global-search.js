// AUDIT_IGNORE
// js/pages/global-search.js
document.addEventListener('DOMContentLoaded',function(){

  var input=document.getElementById('global-search-input');
  var results=document.getElementById('search-results');

  if(!input) return;

  var timer;

  input.addEventListener('input',function(){

    clearTimeout(timer);

    timer=setTimeout(function(){

      if(!results) return;

      var q=input.value.trim();

      if(q.length<2){
        results.innerHTML='';
      }else{
        results.innerHTML='<p style="color:#9CA3AF;padding:16px;">No results for "'+q+'"</p>';
      }

    },300);

  });

});
