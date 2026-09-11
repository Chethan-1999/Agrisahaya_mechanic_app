import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCtsA45E6ZMJ3wQnhuYeciGODVIQFWc3ZU',
  authDomain: 'agrisahay-mechanic-app.firebaseapp.com',
  projectId: 'agrisahay-mechanic-app',
  storageBucket: 'agrisahay-mechanic-app.firebasestorage.app',
  messagingSenderId: '968202600299',
  appId: '1:968202600299:web:a615970a6a93e62b81d62e',
  measurementId: 'G-TFCHKKPH9V',
};

export const firebaseConfigured =
  firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY' && firebaseConfig.appId !== 'YOUR_FIREBASE_APP_ID';
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);