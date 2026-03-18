/**
 * BSTM Firebase Authentication
 * Shared across all pages - role-based redirect + auth guards
 */

// Import Firebase modules from CDN
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Your Firebase config
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

// Export for global access
window.auth = auth;
window.db = db;

/**
 * ROLE-BASED REDIRECT
 * Gets user role from Firestore and redirects to correct dashboard
 */
async function redirectByRole(user) {
    try {
        // Get user document from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const role = userData.role || 'buyer'; // Default to buyer
            
            console.log('User role:', role);
            
            // Redirect based on role
            switch(role) {
                case 'admin':
                case 'gov':
                    window.location.href = 'gov-dashboard.html';
                    break;
                case 'seller':
                    window.location.href = 'seller-dashboard.html';
                    break;
                case 'buyer':
                default:
                    window.location.href = 'buyer-dashboard.html';
                    break;
            }
        } else {
            // User has no Firestore profile - create default buyer profile
            console.log('No user profile found, creating default buyer profile');
            await createUserProfile(user, 'buyer');
            window.location.href = 'buyer-dashboard.html';
        }
    } catch (error) {
        console.error('Error in redirectByRole:', error);
        alert('Failed to load user profile. Please try again.');
    }
}

/**
 * CREATE USER PROFILE
 * Creates Firestore document for new user
 */
async function createUserProfile(user, role = 'buyer') {
    try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            name: user.displayName || user.email.split('@')[0],
            role: role,
            avatar: user.photoURL || null,
            thb_balance: 50, // Welcome bonus
            verified: false,
            referral_code: 'BSTM-' + user.uid.substring(0, 6).toUpperCase(),
            created_at: new Date().toISOString()
        });
        console.log('User profile created');
    } catch (error) {
        console.error('Error creating user profile:', error);
    }
}

/**
 * GOOGLE SIGN-IN
 */
async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        console.log('Google sign-in successful:', user.email);
        
        // Check if user profile exists
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
            // New user - create profile
            await createUserProfile(user, 'buyer');
            alert('Welcome to BSTM! You earned 50 THB! 🎉');
        }
        
        // Redirect based on role
        await redirectByRole(user);
        
    } catch (error) {
        console.error('Google sign-in error:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            alert('Sign-in cancelled');
        } else {
            alert('Sign-in failed: ' + error.message);
        }
    }
}

/**
 * EMAIL/PASSWORD SIGN-IN
 */
async function signInWithEmail(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('Email sign-in successful:', user.email);
        await redirectByRole(user);
        
    } catch (error) {
        console.error('Email sign-in error:', error);
        
        let message = 'Login failed. ';
        if (error.code === 'auth/user-not-found') {
            message += 'No account found with this email.';
        } else if (error.code === 'auth/wrong-password') {
            message += 'Incorrect password.';
        } else {
            message += error.message;
        }
        
        alert(message);
        throw error;
    }
}

/**
 * EMAIL/PASSWORD SIGN-UP
 */
async function signUpWithEmail(email, password, name, role = 'buyer') {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('Account created:', user.email);
        
        // Create Firestore profile
        await createUserProfile(user, role);
        
        alert('Account created! You earned 50 THB bonus! 🎉');
        await redirectByRole(user);
        
    } catch (error) {
        console.error('Sign-up error:', error);
        
        let message = 'Sign-up failed. ';
        if (error.code === 'auth/email-already-in-use') {
            message += 'This email is already registered.';
        } else if (error.code === 'auth/weak-password') {
            message += 'Password must be at least 6 characters.';
        } else {
            message += error.message;
        }
        
        alert(message);
        throw error;
    }
}

/**
 * LOGOUT
 */
async function logout() {
    try {
        await signOut(auth);
        console.log('Logged out successfully');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed: ' + error.message);
    }
}

/**
 * AUTH GUARD
 * Protects dashboard pages - redirects to login if not authenticated
 */
function requireAuth(allowedRoles = []) {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                // Not logged in - redirect to login
                console.log('Not authenticated, redirecting to login');
                window.location.href = 'login.html';
                reject('Not authenticated');
                return;
            }
            
            // User is logged in
            console.log('User authenticated:', user.email);
            
            // If specific roles required, check role
            if (allowedRoles.length > 0) {
                try {
                    const userDocRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userDocRef);
                    
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        
                        if (!allowedRoles.includes(userData.role)) {
                            console.log('User role not allowed on this page');
                            await redirectByRole(user);
                            reject('Wrong role');
                            return;
                        }
                        
                        resolve({ user, userData });
                    } else {
                        reject('No user profile');
                    }
                } catch (error) {
                    console.error('Error checking role:', error);
                    reject(error);
                }
            } else {
                // No specific role required
                resolve({ user });
            }
        });
    });
}

/**
 * GET CURRENT USER DATA
 */
async function getCurrentUserData() {
    const user = auth.currentUser;
    if (!user) return null;
    
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            return {
                ...user,
                ...userDoc.data()
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting user data:', error);
        return null;
    }
}

// Export functions for global use
window.BSTMAuth = {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    logout,
    requireAuth,
    getCurrentUserData,
    redirectByRole
};

console.log('✅ Firebase Auth initialized');
