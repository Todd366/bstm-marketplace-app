(function() {
    fetch('components/nav.html')
        .then(r => r.text())
        .then(html => {
            const el = document.getElementById('bstm-nav');
            if (el) el.innerHTML = html;
            setTimeout(initHamburger, 150);
        })
        .catch(e => console.error('Nav load error:', e));
})();

function initHamburger() {
    const btn = document.getElementById('menu-btn');
    const menu = document.getElementById('mobile-menu');
    
    if (btn && menu) {
        // Old reliable version you liked
        btn.onclick = function(e) {
            e.stopImmediatePropagation();
            if (menu.style.display === 'block') {
                menu.style.display = 'none';
            } else {
                menu.style.display = 'block';
            }
            console.log('✅ Hamburger toggled successfully');
        };
        console.log('✅ Hamburger initialized (old style)');
    }
}

// Extra safety
window.addEventListener('load', () => setTimeout(initHamburger, 800));
