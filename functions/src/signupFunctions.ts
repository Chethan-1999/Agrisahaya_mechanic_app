import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { requireUid } from './lib/authz';
import { db } from './lib/firebaseAdmin';
import { EMPTY_JOB_STATS } from './lib/jobStats';
import * as notify from './lib/notifications';
import { onCall } from './lib/onCall';
import { pushToAdmins } from './lib/push';
import { getSettings } from './lib/settings';
import { technicianRef } from './lib/technicians';
import { parseProfile } from './lib/validation';

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

  const profile = parseProfile(request.data?.profile, await getSettings());
  const ref = technicianRef(uid);
  const existing = await ref.get();

  if (existing.exists) {
    throw new HttpsError('already-exists', 'A profile already exists for this account.');
  }

  const now = new Date().toISOString();

  await ref.set({
    ...profile,
    phoneNumber: phone,
    status: 'pending',
    paymentVerified: false,
    fcmToken: null,
    jobStats: EMPTY_JOB_STATS,
    profileHistory: [],
    createdAt: now,
    updatedAt: now,
    approvedBy: null,
  });

  await pushToAdmins(notify.newSignup(uid, profile));

  return { status: 'created' };
});

/**
 * A technician whose signup was rejected sends it again — as often as they like. Same phone, same record: the profile
 * is overwritten with the (possibly corrected) details and the status goes back to `pending` for the admin to review.
 */
export const reapplySignup = onCall(async (request) => {
  const uid = requireUid(request);
  const profile = parseProfile(request.data?.profile, await getSettings());
  const ref = technicianRef(uid);

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
      ...profile,
      status: 'pending',
      rejectionReason: null,
      reapplyCount: FieldValue.increment(1),
      reappliedAt: now,
      updatedAt: now,
    });
  });

  await pushToAdmins(notify.signupResent(uid, profile.fullName));

  return { status: 'ok' };
});
