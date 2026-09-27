import type { StringKey } from '../i18n/strings';
import { authErrorCode } from './otp/otpErrors';

// Firestore read errors carry a bare code ('failed-precondition', 'unavailable', ...); Cloud Function errors carry
// 'functions/<code>'. Firestore's own messages are written for developers (e.g. "The query requires an index. You can
// create it here: https://console.firebase..."), so they're replaced with a plain message and only logged. Cloud
// Function messages are left alone: every HttpsError we throw is written for the person using the app.
const FIRESTORE_ERROR_KEYS: Record<string, StringKey> = {
  unavailable: 'slowConnectionError',
  'deadline-exceeded': 'slowConnectionError',
  // Usually a missing composite index (see firestore.indexes.json) — a deploy problem the user can't fix.
  'failed-precondition': 'loadFailedError',
  'permission-denied': 'loadFailedError',
  'resource-exhausted': 'loadFailedError',
  internal: 'loadFailedError',
  unknown: 'loadFailedError',
};

const FUNCTION_ERROR_KEYS: Record<string, StringKey> = {
  'functions/unavailable': 'slowConnectionError',
  'functions/deadline-exceeded': 'slowConnectionError',
  // Neither carries a message written for people: 'internal' is an unexpected server failure (its message is just
  // "internal"), 'unauthenticated' means the sign-in ended.
  'functions/internal': 'somethingWentWrong',
  'functions/unauthenticated': 'sessionExpiredError',
};

/** The plain-language message for a Firestore/connection failure, or null when `err`'s own message is fine to show. */
export function dataErrorKey(err: unknown): StringKey | null {
  const code = authErrorCode(err);
  const key = FIRESTORE_ERROR_KEYS[code] ?? FUNCTION_ERROR_KEYS[code] ?? null;

  if (key) console.warn(`Data error (${code}):`, err);

  return key;
}

/**
 * True for text written for developers, not technicians: raw Firebase messages ("Firebase: Error (auth/...)"),
 * anything carrying an error code ("auth/...", "functions/..."), and bare codes like "internal" or "NO_SESSION".
 */
export function isDeveloperMessage(message: string): boolean {
  const text = message.trim();
  return /firebase|firestore|\b[a-z]+\/[a-z-]+\b/i.test(text) || /^[A-Za-z_-]+$/.test(text);
}
