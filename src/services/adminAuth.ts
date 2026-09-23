import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { auth, db, functions } from '../firebase';
import type { AdminProfile } from '../types';
import { currentPushToken } from './notifications';

const registerAdminDeviceFn = httpsCallable<{ fcmToken: string }, { status: 'ok' }>(functions, 'registerAdminDevice');
const unregisterAdminDeviceFn = httpsCallable<{ fcmToken: string }, { status: 'ok' }>(functions, 'unregisterAdminDevice');

/** Registers this device for admin pushes (new signups, job accept/decline/complete, profile-change requests). */
export async function registerAdminDevice(fcmToken: string) {
  await registerAdminDeviceFn({ fcmToken });
}

export async function loginAdmin(email: string, password: string): Promise<AdminProfile> {
  let credentials;

  try {
    credentials = await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (error) {
    throw new Error(getAdminLoginErrorMessage(error));
  }

  const profileSnapshot = await getDoc(doc(db, 'admins', credentials.user.uid));

  if (!profileSnapshot.exists()) {
    await signOut(auth);
    throw new Error('This account is not configured as an admin.');
  }

  const data = profileSnapshot.data();

  return {
    id: credentials.user.uid,
    name: String(data.name ?? 'Admin'),
    email: credentials.user.email ?? email,
    role: 'admin',
  };
}

/** Stops this device's admin pushes (best-effort — a failure must never block logging out), then signs out. */
export async function logoutAdmin() {
  const fcmToken = currentPushToken();

  if (fcmToken) {
    await unregisterAdminDeviceFn({ fcmToken }).catch((err: unknown) => console.warn('failed to unregister push token:', err));
  }

  await signOut(auth);
}

function getAdminLoginErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

  if (code === 'auth/configuration-not-found') {
    return 'Firebase Authentication is not enabled. Enable Authentication and Email/Password sign-in in Firebase Console.';
  }

  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return 'Admin email or password is incorrect, or this admin user has not been created in Firebase Authentication.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Admin login failed.';
}