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

  // Firebase deliberately returns the same code for "no such user" and "wrong password", so we can't
  // tell them apart — and a wrong password is by far the likelier cause for an existing admin.
  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return 'Incorrect email or password. If you forgot the password, ask the project owner to reset it.';
  }

  if (code === 'auth/invalid-email') {
    return 'Enter a valid email address.';
  }

  if (code === 'auth/missing-password') {
    return 'Enter your password.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Too many failed attempts. Wait a few minutes before trying again, or reset the password.';
  }

  if (code === 'auth/network-request-failed') {
    return 'No internet connection. Check your network and try again.';
  }

  if (code === 'auth/user-disabled') {
    return 'This admin account has been disabled.';
  }

  // Any other Firebase code: don't show the raw "Firebase: Error (auth/...)" text.
  if (code.startsWith('auth/')) {
    console.warn('Admin login error:', error);
    return 'Admin login failed. Please try again.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Admin login failed.';
}