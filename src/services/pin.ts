import { signInWithCustomToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import { auth, functions } from '../firebase';

const setPinFn = httpsCallable<{ pin: string }, { status: string }>(functions, 'setPin');
const changePinFn = httpsCallable<{ currentPin: string; newPin: string }, { status: string }>(functions, 'changePin');
const loginWithPinFn = httpsCallable<{ phoneNumber: string; pin: string }, { customToken: string }>(
  functions,
  'loginWithPin',
);

/** Sets the technician's PIN for the first time (post-signup) or resets it after an OTP-verified recovery. */
export async function setPin(pin: string): Promise<void> {
  await setPinFn({ pin });
}

/** Technician-initiated change while they still remember their current PIN. */
export async function changePin(currentPin: string, newPin: string): Promise<void> {
  await changePinFn({ currentPin, newPin });
}

/** Day-to-day sign-in: phone + PIN instead of a fresh OTP every time. Establishes the Firebase session on success. */
export async function loginWithPin(phoneNumber: string, pin: string): Promise<void> {
  const { data } = await loginWithPinFn({ phoneNumber, pin });
  await signInWithCustomToken(auth, data.customToken);
}

export type PinErrorReason = 'PIN_NOT_SET' | 'LOCKED' | 'WRONG_PIN';

/** Pulls the structured `details` (see functions/src/pinFunctions.ts) off a thrown FunctionsError, if present. */
export function getPinErrorInfo(error: unknown): { reason?: PinErrorReason; remainingAttempts?: number } {
  const details =
    error && typeof error === 'object' && 'details' in error ? (error as { details?: unknown }).details : undefined;

  if (!details || typeof details !== 'object') return {};

  const reason = (details as Record<string, unknown>).reason;
  const remainingAttempts = (details as Record<string, unknown>).remainingAttempts;

  return {
    reason: typeof reason === 'string' ? (reason as PinErrorReason) : undefined,
    remainingAttempts: typeof remainingAttempts === 'number' ? remainingAttempts : undefined,
  };
}
