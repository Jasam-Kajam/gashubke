// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: Replace with your project's fragile config credentials
const firebaseConfig = {
 apiKey: "AIzaSyBHxLJOZ5bdApAhSKOn2v9GtgrbsIxK_6A",
  authDomain: "gashub-917f2.firebaseapp.com",
  projectId: "gashub-917f2",
  storageBucket: "gashub-917f2.firebasestorage.app",
  messagingSenderId: "738809329471",
  appId: "1:738809329471:web:7eeebcc400b2ea1b71c58a",
  measurementId: "G-DLB7ZQ1E7F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
