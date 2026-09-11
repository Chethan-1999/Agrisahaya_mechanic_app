import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const app = getApps().length ? getApps()[0] : initializeApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
