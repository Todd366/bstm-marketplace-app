// Firebase compat - redirect auth, no popup, no billing
console.log('Auth loading...');

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

// Start redirect sign-in
function signInWithGoogle() {
  console.log('Starting redirect...');
  showLoading();
  
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  
  firebase.auth().signInWithRedirect(provider);
}

// On page load: check if we're back from Google
firebase.auth().getRedirectResult()
  .then(result => {
    if (result.user) {
      console.log('Sign-in success:', result.user.email);
      alert('Welcome, ' + result.user.displayName + '! 🎉');
      window.location.href = 'buyer-dashboard.html';
    } else {
      console.log('No redirect result - normal load');
      hideLoading();
    }
  })
  .catch(error => {
    console.error('Redirect fail:', error);
    hideLoading();
    alert('Failed: ' + error.message);
  });

// Auto-redirect if already signed in
firebase.auth().onAuthStateChanged(user => {
  if (user && window.location.pathname.includes('login.html')) {
    window.location.href = 'buyer-dashboard.html';
  }
});

window.signInWithGoogle = signInWithGoogle;
