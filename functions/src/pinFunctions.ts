import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireDoc } from './lib/docHelpers';
import { auth, db } from './lib/firebaseAdmin';
import { normalizePhone } from './lib/phone';
import { assertChangeAllowedAndAppendLog, assertValidPin, hashPin, verifyPinOrTrackFailure } from './lib/pin';

/**
 * Sets the technician's PIN for the first time (right after signup) or
 * resets it after an OTP-verified recovery — one function for both, since
 * the only real difference (whether it counts against the 30-day change
 * cap) is derived from whether a PIN was already set. Refuses to run from a
 * PIN-derived session (see loginWithPin's `pinSession` claim below) so a
 * technician can't use this to bypass changePin's current-PIN check.
 */
export const setPin = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  if (request.auth?.token?.pinSession === true) {
    throw new HttpsError('permission-denied', 'Log out and verify your phone number to reset your PIN.');
  }

  const pin = request.data?.pin;
  assertValidPin(pin);

  const ref = db.collection('technicians').doc(uid);
  const snap = await requireDoc(ref, 'Technician not found.');
  const data = snap.data() ?? {};

  const pinChangeLog = data.pinHash
    ? assertChangeAllowedAndAppendLog(data.pinChangeLog as string[] | undefined)
    : ((data.pinChangeLog as string[] | undefined) ?? []);

  await ref.update({
    pinHash: await hashPin(pin),
    pinFailedAttempts: 0,
    pinLocked: false,
    pinSetAt: new Date().toISOString(),
    pinChangeLog,
  });

  return { status: 'ok' };
});

/** Technician-initiated change while they still remember their current PIN. */
export const changePin = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const currentPin = request.data?.currentPin;
  const newPin = request.data?.newPin;
  assertValidPin(currentPin);
  assertValidPin(newPin);

  if (currentPin === newPin) {
    throw new HttpsError('invalid-argument', 'New PIN must be different from your current PIN.');
  }

  const ref = db.collection('technicians').doc(uid);
  const snap = await requireDoc(ref, 'Technician not found.');
  const data = snap.data() ?? {};

  if (!data.pinHash) {
    throw new HttpsError('failed-precondition', 'No PIN set yet — verify your phone number to create one.');
  }

  if (data.pinLocked) {
    throw new HttpsError(
      'permission-denied',
      'Your account is locked. Verify your phone number to reset your PIN.',
      { reason: 'LOCKED' },
    );
  }

  await verifyPinOrTrackFailure(ref, data.pinHash as string, currentPin);

  const pinChangeLog = assertChangeAllowedAndAppendLog(data.pinChangeLog as string[] | undefined);

  await ref.update({
    pinHash: await hashPin(newPin),
    pinFailedAttempts: 0,
    pinLocked: false,
    pinSetAt: new Date().toISOString(),
    pinChangeLog,
  });

  return { status: 'ok' };
});

/** The day-to-day sign-in entrypoint: phone + PIN instead of a fresh OTP every time. */
export const loginWithPin = onCall(async (request) => {
  const phoneRaw = request.data?.phoneNumber;
  const pin = request.data?.pin;

  if (typeof phoneRaw !== 'string') {
    throw new HttpsError('invalid-argument', 'A phone number is required.');
  }
  assertValidPin(pin);

  let phone: string;
  try {
    phone = normalizePhone(phoneRaw);
  } catch {
    throw new HttpsError('invalid-argument', 'Enter a valid 10-digit phone number.');
  }

  const matches = await db.collection('technicians').where('phoneNumber', '==', phone).limit(1).get();

  if (matches.empty) {
    throw new HttpsError('not-found', 'No account found with this number.');
  }

  const doc = matches.docs[0];
  const data = doc.data();

  if (!data.pinHash) {
    throw new HttpsError('failed-precondition', 'No PIN set yet. Verify your phone number to create one.', {
      reason: 'PIN_NOT_SET',
    });
  }

  if (data.pinLocked) {
    throw new HttpsError(
      'permission-denied',
      'Too many wrong attempts. Verify your phone number to reset your PIN.',
      { reason: 'LOCKED' },
    );
  }

  await verifyPinOrTrackFailure(doc.ref, data.pinHash as string, pin);

  const customToken = await auth.createCustomToken(doc.id, { pinSession: true });
  return { customToken };
});
