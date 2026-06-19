const admin = require('firebase-admin');

const serviceAccount = {
  "type": "service_account", // REMOVED FOR PUSH
  "project_id": "YOUR_PROJECT_ID", // REMOVED
  "private_key_id": "REMOVED",
  "private_key": "REMOVED",
  "client_email": "your-service@project.iam.gserviceaccount.com", // REMOVED
  "client_id": "112277180274702509259",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40gen-lang-client-0007945213.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://gen-lang-client-0007945213.firebaseio.com"
});

const db = admin.firestore();

async function getUserByEmail(email) {
  const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

async function getUserById(userId) {
  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function createUser(email) {
  const userData = {
    email,
    name: email.split('@')[0],
    role: 'buyer',
    thb_balance: 50.0,
    referral_code: 'BSTM-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    last_login: admin.firestore.FieldValue.serverTimestamp()
  };
  const docRef = await db.collection('users').add(userData);
  return { id: docRef.id, ...userData };
}

async function updateLastLogin(userId) {
  await db.collection('users').doc(userId).update({
    last_login: admin.firestore.FieldValue.serverTimestamp()
  });
}

module.exports = {
  getUserByEmail,
  getUserById,
  createUser,
  updateLastLogin
};
