// Firebase Auth - compat, no Firestore
console.log('🔥 Auth loading...');

if (typeof firebase === 'undefined') {
  console.error('Firebase SDK missing!');
}

const auth = firebase.auth();

function showLoading() {
  const l = document.getElementById('loading');
  if (l) l.style.display = 'block';
  const f = document.getElementById('login-form');
  if (f) f.style.display = 'none';
}

function hideLoading() {
  const l = document.getElementById('loading');
  if (l) l.style.display = 'none';
  const f = document.getElementById('login-form');
  if (f) f.style.display = 'block';
}

function signInWithGoogle() {
  console.log('Starting sign-in...');
  showLoading();
  
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' }); // <-- this kills loop
  
  auth.signInWithPopup(provider)
    .then(result => {
      const user = result.user;
      alert('Welcome, ' + user.displayName + '! 🎉');
      window.location.href = 'buyer-dashboard.html';
    })
    .catch(error => {
      console.error('Auth fail:', error);
      hideLoading();
      alert('Failed: ' + error.message);
    });
}

auth.onAuthStateChanged(user => {
  if (user && window.location.pathname.includes('login.html')) {
    window.location.href = 'buyer-dashboard.html';
  }
});

window.signInWithGoogle = signInWithGoogle;
function signOutFirst() { auth.signOut().then(() => location.reload()); }
