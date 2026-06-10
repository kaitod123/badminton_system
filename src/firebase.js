// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCFtarPK8RSoiwzGiqAo7bFv4tZItTFG54",
  authDomain: "badminton-system-7ca2e.firebaseapp.com",
  projectId: "badminton-system-7ca2e",
  storageBucket: "badminton-system-7ca2e.firebasestorage.app",
  messagingSenderId: "387691608159",
  appId: "1:387691608159:web:ab6cab5750a361c94203ea",
  measurementId: "G-11XRP0QYY8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);