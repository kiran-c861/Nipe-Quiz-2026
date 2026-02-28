/*
==========================================================
  NIPE QUIZ PORTAL — Firebase Configuration
  ✅ Firebase Firestore — Multi-Device Sync
==========================================================

  ⚠️ IMPORTANT: After creating your Firestore database,
  set these Firestore Security Rules in Firebase Console
  (Firestore → Rules tab):

  ────────────────────────────────────────────────────────
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if true;
      }
    }
  }
  ────────────────────────────────────────────────────────

  Then create these two collections manually OR they will
  be created automatically on first save:
    - nipe_main   (stores quizzes, selections, congrats)
    - nipe_results (stores each quiz submission)

==========================================================
*/

const firebaseConfig = {
  apiKey: "AIzaSyBmL14vf3VQiQXyVVNUJRGuhyjBUcBDzog",
  authDomain: "nipe-quiz.firebaseapp.com",
  projectId: "nipe-quiz",
  storageBucket: "nipe-quiz.firebasestorage.app",
  messagingSenderId: "1013742179207",
  appId: "1:1013742179207:web:a0176545fdbaa755707922",
  measurementId: "G-VQ6LW412BW"
};

// Initialize Firebase app & Firestore
firebase.initializeApp(firebaseConfig);
const fsdb = firebase.firestore();
