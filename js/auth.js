// Firebase imports from CDN
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBlpLfL6ProXUrqhr9FGET7ACfPOKBudSw",
  authDomain: "gen-lang-client-0007945213.firebaseapp.com",
  projectId: "gen-lang-client-0007945213",
  storageBucket: "gen-lang-client-0007945213.firebasestorage.app",
  messagingSenderId: "570021771449",
  appId: "1:570021771449:web:70d9e7e254d4ff7e654368",
  measurementId: "G-HPSWPH0R7Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('✅ Firebase initialized');

// Export globally
window.auth = auth;
window.db = db;

// Show loading spinner
function showLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'block';
  
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.style.display = 'none';
}

// Hide loading spinner
function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
  
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.style.display = 'block';
}

// Check user role and redirect (with fallback)
async function redirectBasedOnRole(user) {
  try {
    console.log('Checking user role for:', user.email);
    
    // Try to get user from Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const role = userData.role || 'buyer';
      
      console.log('User role from Firestore:', role);
      
      // Redirect based on role
      if (role === 'admin' || role === 'gov') {
        window.location.href = 'gov-dashboard.html';
      } else if (role === 'seller') {
        window.location.href = 'seller-dashboard.html';
      } else {
        window.location.href = 'buyer-dashboard.html';
      }
      
    } else {
      // User doesn't exist in Firestore - create profile
      console.log('Creating new user profile');
      
      try {
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
          role: 'buyer',
          avatar: user.photoURL || null,
          thb_balance: 50,
          verified: true,
          referral_code: 'BSTM-' + user.uid.substring(0, 6).toUpperCase(),
          created_at: new Date().toISOString()
        });
        
        console.log('✅ User profile created');
        alert('Welcome to BSTM! You earned 50 THB! 🎉');
        window.location.href = 'buyer-dashboard.html';
        
      } catch (createError) {
        console.error('Error creating profile:', createError);
        
        // FALLBACK: If Firestore fails, still redirect to buyer dashboard
        console.log('⚠️ Using fallback redirect (Firestore may not be ready)');
        alert('Welcome to BSTM! (Profile will be created shortly)');
        window.location.href = 'buyer-dashboard.html';
      }
    }
    
  } catch (error) {
    console.error('❌ Error in redirectBasedOnRole:', error);
    
    // CRITICAL FALLBACK: Always redirect even if Firestore fails
    console.log('⚠️ Firestore error - using emergency fallback');
    
    if (error.code === 'unavailable' || error.message.includes('Firestore')) {
      alert('Welcome to BSTM! Database is initializing, some features may be limited.');
    }
    
    // Default redirect to buyer dashboard
    window.location.href = 'buyer-dashboard.html';
  }
}

// Google Sign-In function
window.signInWithGoogle = async function() {
  console.log('🚀 Starting Google sign-in...');
  showLoading();
  
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  
  try {
    console.log('Opening Google popup...');
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    console.log('✅ Google sign-in successful:', user.email);
    console.log('User UID:', user.uid);
    
    // Redirect based on role (with fallback)
    await redirectBasedOnRole(user);
    
  } catch (error) {
    console.error('❌ Auth error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    hideLoading();
    
    let errorMessage = 'Sign-in failed. ';
    
    if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Sign-in cancelled.';
    } else if (error.code === 'auth/popup-blocked') {
      errorMessage = 'Popup was blocked. Please allow popups and try again.';
    } else if (error.code === 'auth/unauthorized-domain') {
      errorMessage = 'This domain is not authorized. Please use the official BSTM site.';
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMessage = 'Google sign-in is not enabled. Please contact support.';
    } else if (error.code === 'auth/invalid-api-key') {
      errorMessage = 'Invalid API configuration.';
    } else {
      errorMessage += error.message;
    }
    
    alert(errorMessage);
  }
};

// Check if already logged in (when page loads)
onAuthStateChanged(auth, (user) => {
  if (user && window.location.pathname.includes('login.html')) {
    console.log('User already logged in on page load, redirecting...');
    redirectBasedOnRole(user);
  }
});

console.log('✅ Auth module loaded successfully');
