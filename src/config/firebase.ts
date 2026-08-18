// src/config/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
   apiKey: "AIzaSyCPlQLnCIiy1usCNOJwWWh1hn215QlbkUI",
  authDomain: "carteira-estudante-8b3ad.firebaseapp.com",
  projectId: "carteira-estudante-8b3ad",
  storageBucket: "carteira-estudante-8b3ad.firebasestorage.app",
  messagingSenderId: "27438446057",
  appId: "1:27438446057:web:791b104f88875762adc778",
  measurementId: "G-X06XF02H3N"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);