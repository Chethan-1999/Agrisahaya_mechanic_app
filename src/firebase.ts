import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const env = import.meta.env;

// Which Firebase project this build talks to is entirely env-driven (see
// .env.example) so the frontend never hardcodes — and is decoupled from — a
// specific backend deployment. Fail fast with a clear error instead of
// silently booting against an empty config.
const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;
const missingKeys = requiredKeys.filter((key) => !env[key]);
export const firebaseConfigured = missingKeys.length === 0;
if (!firebaseConfigured) {
  console.error(
    `Missing Firebase config env vars: ${missingKeys.join(', ')}. Copy .env.example to .env and fill in your Firebase project's values.`,
  );
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp);

// Baked in at build time by `npm run dev:local` (see scripts/local-dev.mjs) so a
// device on the same network hits this laptop's Firebase Emulator Suite instead
// of production Firebase. Unset in every normal build, so production is unaffected.
const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST;
if (emulatorHost) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
  connectFunctionsEmulator(functions, emulatorHost, 5001);
}