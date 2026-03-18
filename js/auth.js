// Firebase Auth (Compat mode - no modules)
// Uses global firebase object loaded from CDN

console.log('🔥 Auth module loading...');

// Wait for Firebase to be ready
if (typeof firebase === 'undefined') {
  console.error('❌ Firebase not loaded! Check script tags in HTML.');
}

const auth = firebase.auth();

// Show loading overlay
function showLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'block';
  
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.style.display = 'none';
}

// Hide loading overlay
function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
  
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.style.display = 'block';
}

// Google Sign-In (with account picker forced)
function signInWithGoogle() {
  console.log('🚀 Starting Google sign-in...');
  showLoading();
  
  const provider = new firebase.auth.GoogleAuthProvider();
  
  // FORCE ACCOUNT PICKER - This stops the loop!
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  
  auth.signInWithPopup(provider)
    .then((result) => {
      const user = result.user;
      console.log('✅ Login successful:', user.email);
      
      // Show success alert
      alert('Welcome to BSTM, ' + user.displayName + '! 🎉');
      
      // Redirect to buyer dashboard (hardcoded for now - no Firestore)
      console.log('Redirecting to buyer dashboard...');
      window.location.href = 'buyer-dashboard.html';
    })
    .catch((error) => {
      console.error('❌ Auth error:', error.code, error.message);
      hideLoading();
      
      let errorMessage = 'Sign-in failed. ';
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in cancelled.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Popup blocked! Please allow popups for this site.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = 'This domain is not authorized. Use: https://todd366.github.io';
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
    });
}

// Check if already logged in
auth.onAuthStateChanged((user) => {
  if (user && window.location.pathname.includes('login.html')) {
    console.log('✅ User already logged in:', user.email);
    console.log('Auto-redirecting to dashboard...');
    window.location.href = 'buyer-dashboard.html';
  }
});

console.log('✅ Auth module ready');

// Sign out function for login page
function signOutFirst() {
  auth.signOut().then(() => {
    alert('Signed out successfully. You can now sign in with a different account.');
    location.reload();
  }).catch((error) => {
    console.error('Sign out error:', error);
    alert('Sign out failed: ' + error.message);
  });
}

// Sign out function for login page
function signOutFirst() {
  auth.signOut().then(() => {
    alert('Signed out successfully. You can now sign in with a different account.');
    location.reload();
  }).catch((error) => {
    console.error('Sign out error:', error);
    alert('Sign out failed: ' + error.message);
  });
}
