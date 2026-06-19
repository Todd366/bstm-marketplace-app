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

console.log('✅ Firebase Admin initialized with your full JSON key');
module.exports = admin;
