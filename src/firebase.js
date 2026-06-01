import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAc7Zj3Di-SBHDmjnzmsqPbh_mYg4XIyuk",
  authDomain: "bulletiin--with-tiims.firebaseapp.com",
  projectId: "bulletiin--with-tiims",
  storageBucket: "bulletiin--with-tiims.firebasestorage.app",
  messagingSenderId: "168890483458",
  appId: "1:168890483458:web:9ca62c047d284dc950b81b",
  measurementId: "G-ERPC9HJGG6"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();