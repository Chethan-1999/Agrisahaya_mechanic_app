import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAMKzPPkHFxug_-1vOr0J5_DqaWdDNPiE8',
  authDomain: 'mechanicapp-3ebb8.firebaseapp.com',
  projectId: 'mechanicapp-3ebb8',
  storageBucket: 'mechanicapp-3ebb8.firebasestorage.app',
  messagingSenderId: '738112371753',
  appId: '1:738112371753:web:3c482f1239e63b735cb038',
  measurementId: 'G-L5X5B21WJX',
};

export const firebaseConfigured =
  firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY' && firebaseConfig.appId !== 'YOUR_FIREBASE_APP_ID';
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);