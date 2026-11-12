/* Firebase — auth + Firestore cloud sync (localStorage offline cache ke saath)
   NOTE: firebase web config client-safe hoti hai (public by design);
   data ki security Firestore rules se hoti hai (firebase/firestore.rules) */
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD1dndWbms4BPRduYh29eCv5mCf6QjbZC4",
  authDomain: "notebook-lab-app.firebaseapp.com",
  projectId: "notebook-lab-app",
  storageBucket: "notebook-lab-app.firebasestorage.app",
  messagingSenderId: "260664809749",
  appId: "1:260664809749:web:af62225446269f644c711c",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
