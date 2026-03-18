/**
 * BSTM Firebase Authentication
 */

import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const FirebaseAuth = {
  
  // Sign up new user
  async signup(email, password, name, role) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Create user profile in Firestore
      await FirebaseDB.createUser(user.uid, {
        name: name,
        email: email,
        role: role,
        thb_balance: 50, // Welcome bonus
        referral_code: 'BSTM-' + user.uid.substring(0, 6).toUpperCase(),
        created_at: new Date().toISOString()
      });
      
      return user;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  },
  
  // Login
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },
  
  // Google Sign In
  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      
      // Check if new user, create profile
      const userExists = await FirebaseDB.getUser(result.user.uid);
      if (!userExists) {
        await FirebaseDB.createUser(result.user.uid, {
          name: result.user.displayName,
          email: result.user.email,
          role: 'buyer',
          thb_balance: 50,
          avatar: result.user.photoURL,
          referral_code: 'BSTM-' + result.user.uid.substring(0, 6).toUpperCase(),
          created_at: new Date().toISOString()
        });
      }
      
      return result.user;
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  },
  
  // Logout
  async logout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },
  
  // Get current user
  getCurrentUser() {
    return auth.currentUser;
  },
  
  // Listen to auth state changes
  onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
  }
};

window.FirebaseAuth = FirebaseAuth;
export default FirebaseAuth;
