(function () {
  fetch('components/nav.html')
    .then(function (r) { return r.text(); })
    .then(function (html) {
      var el = document.getElementById('bstm-nav');
      if (el) el.innerHTML = html;
    })
    .catch(function (e) {
      console.log('Nav load error:', e);
    });
})();
