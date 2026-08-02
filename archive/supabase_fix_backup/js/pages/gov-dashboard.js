import './js/firebase-auth.js';

    window.BSTMAuth.requireAuth(['admin', 'gov']).then(({ user, userData }) => {
        document.getElementById('userName').textContent = userData.name;
    });

    window.handleLogout = async function() {
        if (confirm('Logout?')) await window.BSTMAuth.logout();
    };