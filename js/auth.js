// Firebase Config & Auth (single file)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBlpLfL6ProXUrqhr9FGET7ACfPOKBudSw",
  authDomain: "gen-lang-client-0007945213.firebaseapp.com",
  projectId: "gen-lang-client-0007945213",
  storageBucket: "gen-lang-client-0007945213.firebasestorage.app",
  messagingSenderId: "570021771449",
  appId: "1:570021771449:web:70d9e7e254d4ff7e654368"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Sign in
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    alert("Signed in as " + user.displayName + "!");
    await redirectBasedOnRole(user);
  } catch (error) {
    alert("Login failed: " + error.message);
  }
}

// Logout
export async function logout() {
  await signOut(auth);
  alert("Logged out!");
  window.location.href = "/login.html";
}

// Role redirect (Firestore 'users/{uid}' → role: buyer/seller/gov)
async function redirectBasedOnRole(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  let role = "buyer"; // default
  if (userSnap.exists()) {
    role = userSnap.data().role || "buyer";
  }
  window.location.href = `/${role}-dashboard.html`;
}

// Auth guard for dashboards (redirect to login if not signed in)
export function protectPage() {
  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "/login.html";
  });
}

// Expose for HTML buttons
window.signInWithGoogle = signInWithGoogle;
window.logout = logout;
