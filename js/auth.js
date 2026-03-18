// Plain Firebase Auth - no Firestore, no billing
const firebaseConfig = {
  apiKey: "AIzaSyBlpLfL6ProXUrqhr9FGET7ACfPOKBudSw",
  authDomain: "gen-lang-client-0007945213.firebaseapp.com",
  projectId: "gen-lang-client-0007945213",
  storageBucket: "gen-lang-client-0007945213.firebasestorage.app",
  messagingSenderId: "570021771449",
  appId: "1:570021771449:web:70d9e7e254d4ff7e654368"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

function signInWithGoogle() {
  document.getElementById("loading").style.display = "block";
  document.getElementById("login-form").style.display = "none";

  auth.signInWithPopup(provider)
    .then((result) => {
      const user = result.user;
      alert("Signed in as " + user.displayName + "! Welcome to buyer mode.");
      window.location.href = "/buyer-dashboard.html";  // default, no role check
    })
    .catch((error) => {
      document.getElementById("loading").style.display = "none";
      alert("Login failed: " + error.message);
    });
}

function logout() {
  auth.signOut().then(() => {
    alert("Logged out!");
    window.location.href = "/login.html";
  });
}

window.signInWithGoogle = signInWithGoogle;
window.logout = logout;

auth.onAuthStateChanged((user) => {
  if (user && window.location.pathname.includes('login.html')) {
    window.location.href = "/buyer-dashboard.html";
  }
});
