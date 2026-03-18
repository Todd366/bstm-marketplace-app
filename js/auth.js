// Firebase Auth - plain JS version
const firebaseConfig = {
  apiKey: "AIzaSyBlpLfL6ProXUrqhr9FGET7ACfPOKBudSw",
  authDomain: "gen-lang-client-0007945213.firebaseapp.com",
  projectId: "gen-lang-client-0007945213",
  storageBucket: "gen-lang-client-0007945213.firebasestorage.app",
  messagingSenderId: "570021771449",
  appId: "1:570021771449:web:70d9e7e254d4ff7e654368"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

function signInWithGoogle() {
  auth.signInWithRedirect(provider)
    .then((result) => {
      const user = result.user;
      alert("Signed in as " + user.displayName + "!");
      redirectBasedOnRole(user);
    })
    .catch((error) => {
      alert("Login failed: " + error.message);
    });
}

function logout() {
  auth.signOut().then(() => {
    alert("Logged out!");
    window.location.href = "/login.html";
  });
}

function redirectBasedOnRole(user) {
  db.collection("users").doc(user.uid).get().then((doc) => {
    let role = "buyer";
    if (doc.exists) {
      role = doc.data().role || "buyer";
    }
    window.location.href = "/" + role + "-dashboard.html";
  });
}

function protectPage() {
  auth.onAuthStateChanged((user) => {
    if (!user) window.location.href = "/login.html";
  });
}

// Expose globally
window.signInWithGoogle = signInWithGoogle;
window.logout = logout;
