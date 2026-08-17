// js/pages/global-search.js
// FIXME: this search box is currently fake — it never queries products or
// rooms, it always just echoes back "No results for X" regardless of what
// was typed. Needs a real debounced Supabase query against products+rooms.
// Not currently referenced by any page — safe to rewrite fully when built.
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

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
        results.innerHTML='<p style="color:#9CA3AF;padding:16px;">No results for "'+escapeHtml(q)+'"</p>';
      }

    },300);

  });

});
