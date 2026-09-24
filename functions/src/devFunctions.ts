import { HttpsError } from 'firebase-functions/v2/https';

import { auth, db } from './lib/firebaseAdmin';
import { onCall } from './lib/onCall';
import { normalizePhone } from './lib/phone';

/**
 * Local-dev-only sign-in shortcut, paired with the client's local OTP
 * provider (src/services/otp/localOtpProvider.ts) — that provider generates
 * and checks its own throwaway 6-digit code, then calls this function purely
 * to get a real Firebase Auth session for the phone number, the same way
 * `signInWithPhoneNumber` would in production. This function does not
 * itself verify a code — the client already did — it only establishes the
 * session, exactly like Firebase's own phone-auth backend does.
 *
 * Hard-refuses outside the emulator: FUNCTIONS_EMULATOR is set automatically
 * by `firebase emulators:start` and is never set on deployed functions, so
 * this is inert — not just unused — if it's ever accidentally deployed.
 */
export const devSignIn = onCall(async (request) => {
  if (process.env.FUNCTIONS_EMULATOR !== 'true') {
    throw new HttpsError('permission-denied', 'devSignIn only runs in the local Firebase emulator.');
  }

  const phoneRaw = request.data?.phone;

  if (typeof phoneRaw !== 'string') {
    throw new HttpsError('invalid-argument', 'A phone number is required.');
  }

  let phone: string;
  try {
    phone = normalizePhone(phoneRaw);
  } catch {
    throw new HttpsError('invalid-argument', 'Enter a valid 10-digit phone number.');
  }

  const existingTechnician = await db.collection('technicians').where('phoneNumber', '==', phone).limit(1).get();

  if (!existingTechnician.empty) {
    const customToken = await auth.createCustomToken(existingTechnician.docs[0].id);
    return { customToken };
  }

  // No technician yet for this phone. Reuse (or create) the underlying Auth
  // user the same way real Phone Auth would, so its record carries
  // `phoneNumber` — that's what gives the ID token a `phone_number` claim,
  // which completeSignup relies on identically in both modes.
  let userRecord;
  try {
    userRecord = await auth.getUserByPhoneNumber(phone);
  } catch {
    userRecord = await auth.createUser({ phoneNumber: phone });
  }

  const customToken = await auth.createCustomToken(userRecord.uid);
  return { customToken };
});
