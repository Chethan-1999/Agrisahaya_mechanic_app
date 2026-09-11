import bcrypt from 'bcryptjs';
import type { DocumentReference } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { db } from './firebaseAdmin';

export const PIN_LENGTH = 4;
export const MAX_FAILED_ATTEMPTS = 5;
export const MAX_CHANGES_PER_WINDOW = 3;
export const CHANGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const PIN_PATTERN = new RegExp(`^\\d{${PIN_LENGTH}}$`);

export function assertValidPin(pin: unknown): asserts pin is string {
  if (typeof pin !== 'string' || !PIN_PATTERN.test(pin)) {
    throw new HttpsError('invalid-argument', `PIN must be exactly ${PIN_LENGTH} digits.`);
  }
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

/**
 * Shared by loginWithPin and changePin's current-PIN check — one lockout
 * counter regardless of which endpoint is asking, so wrong guesses can't
 * effectively double the attempt budget by splitting them across both.
 */
export async function verifyPinOrTrackFailure(
  ref: DocumentReference,
  storedHash: string,
  suppliedPin: string,
): Promise<void> {
  const matches = await bcrypt.compare(suppliedPin, storedHash);

  if (matches) {
    await ref.update({ pinFailedAttempts: 0 });
    return;
  }

  const { attempts, locked } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const nextAttempts = ((snap.data()?.pinFailedAttempts as number | undefined) ?? 0) + 1;
    const nextLocked = nextAttempts >= MAX_FAILED_ATTEMPTS;
    tx.update(ref, { pinFailedAttempts: nextAttempts, ...(nextLocked ? { pinLocked: true } : {}) });
    return { attempts: nextAttempts, locked: nextLocked };
  });

  if (locked) {
    throw new HttpsError(
      'permission-denied',
      'Too many wrong attempts. Verify your phone number to reset your PIN.',
      { reason: 'LOCKED' },
    );
  }

  throw new HttpsError('permission-denied', 'Incorrect PIN.', {
    reason: 'WRONG_PIN',
    remainingAttempts: MAX_FAILED_ATTEMPTS - attempts,
  });
}

/**
 * Prunes pinChangeLog to the last 30 days and throws if the technician
 * already used all 3 changes/resets in that window; otherwise returns the
 * pruned log with this change appended, ready to write back.
 */
export function assertChangeAllowedAndAppendLog(pinChangeLog: string[] | undefined): string[] {
  const now = Date.now();
  const recent = (pinChangeLog ?? []).filter((iso) => now - new Date(iso).getTime() < CHANGE_WINDOW_MS);

  if (recent.length >= MAX_CHANGES_PER_WINDOW) {
    throw new HttpsError(
      'resource-exhausted',
      `You can only change your PIN ${MAX_CHANGES_PER_WINDOW} times every 30 days. Try again later.`,
    );
  }

  return [...recent, new Date(now).toISOString()];
}
