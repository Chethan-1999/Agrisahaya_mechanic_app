import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { db } from './lib/firebaseAdmin';
import { onCall } from './lib/onCall';
import { pushToAdmins } from './lib/push';
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
    jobStats: { pending: 0, completed: 0, cancelled: 0, deleted: 0 },
    profileHistory: [],
    createdAt: now,
    updatedAt: now,
    approvedBy: null,
  });

  await pushToAdmins({
    title: '🆕 New mechanic signup',
    body: `${profile.fullName.trim()} · ${profile.village.trim()}, ${profile.district.trim()} — tap to review`,
    data: { type: 'admin-signup', technicianId: uid },
  });

  return { status: 'created' };
});

/**
 * A technician whose signup was rejected sends it again — as often as they like. Same phone, same record: the profile
 * is overwritten with the (possibly corrected) details and the status goes back to `pending` for the admin to review.
 */
export const reapplySignup = onCall(async (request) => {
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
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

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      throw new HttpsError('not-found', 'Mechanic profile not found.');
    }
    if (snap.data()?.status !== 'rejected') {
      throw new HttpsError('failed-precondition', 'Only a rejected signup can be sent again.');
    }

    const now = new Date().toISOString();

    tx.update(ref, {
      fullName: profile.fullName.trim(),
      village: profile.village.trim(),
      district: profile.district.trim(),
      state: (profile.state ?? '').trim(),
      pincode: (profile.pincode ?? '').trim(),
      address: (profile.address ?? '').trim(),
      landmark: (profile.landmark ?? '').trim() || null,
      age: String(profile.age).trim(),
      experience: String(profile.experience).trim(),
      status: 'pending',
      rejectionReason: null,
      reapplyCount: FieldValue.increment(1),
      reappliedAt: now,
      updatedAt: now,
    });
  });

  await pushToAdmins({
    title: '🔁 Signup sent again',
    body: `${profile.fullName.trim()} updated their rejected signup — tap to review`,
    data: { type: 'admin-signup', technicianId: uid },
  });

  return { status: 'ok' };
});
