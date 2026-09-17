import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { db } from './lib/firebaseAdmin';
import { assertValidProfile, type ProfileInput } from './lib/validation';

/**
 * Creates the technician record for an already-verified phone number.
 *
 * Phone ownership is proven before this ever runs — by Firebase's own Phone
 * Auth in production, or the local dev provider's devSignIn in the emulator
 * (see services/otp/ on the client, functions/src/devFunctions.ts here).
 * Either way, `request.auth.token.phone_number` is trustworthy: Firebase
 * sets it directly from the Auth user record, so there's nothing left for
 * this function to verify — it only has one job, creating the record.
 */
export const completeSignup = onCall(async (request) => {
  const uid = request.auth?.uid;
  const phone = request.auth?.token?.phone_number as string | undefined;

  if (!uid || !phone) {
    throw new HttpsError('unauthenticated', 'Verify your phone number first.');
  }

  const profile = request.data?.profile as ProfileInput | undefined;

  if (!profile) {
    throw new HttpsError('invalid-argument', 'Profile is required.');
  }

  try {
    assertValidProfile(profile);
  } catch (err) {
    throw new HttpsError('invalid-argument', err instanceof Error ? err.message : 'Invalid profile.');
  }

  const ref = db.collection('technicians').doc(uid);
  const existing = await ref.get();

  if (existing.exists) {
    throw new HttpsError('already-exists', 'A profile already exists for this account.');
  }

  const now = new Date().toISOString();

  await ref.set({
    fullName: profile.fullName.trim(),
    phoneNumber: phone,
    village: profile.village.trim(),
    district: profile.district.trim(),
    state: (profile.state ?? '').trim(),
    pincode: (profile.pincode ?? '').trim(),
    address: (profile.address ?? '').trim(),
    landmark: (profile.landmark ?? '').trim() || null,
    age: String(profile.age).trim(),
    experience: String(profile.experience).trim(),
    status: 'pending',
    paymentVerified: false,
    fcmToken: null,
    jobStats: { pending: 0, completed: 0, cancelled: 0 },
    profileHistory: [],
    createdAt: now,
    updatedAt: now,
    approvedBy: null,
  });

  return { status: 'created' };
});
