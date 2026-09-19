import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAdmin } from './lib/authz';
import { requireDoc } from './lib/docHelpers';
import { auth, db } from './lib/firebaseAdmin';
import { pushToTechnician } from './lib/push';
import { assertValidProfile, type ProfileInput } from './lib/validation';

/** Admin approves or rejects a pending technician. This is the activation gate. */
export const reviewSignup = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { technicianId, decision, paymentVerified } = request.data ?? {};

  if (typeof technicianId !== 'string' || (decision !== 'approve' && decision !== 'reject')) {
    throw new HttpsError('invalid-argument', 'technicianId and a valid decision are required.');
  }

  const ref = db.collection('technicians').doc(technicianId);
  const snap = await requireDoc(ref, 'Mechanic not found.');

  if (snap.data()?.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'This mechanic has already been reviewed.');
  }

  await ref.update({
    status: decision === 'approve' ? 'active' : 'rejected',
    paymentVerified: typeof paymentVerified === 'boolean' ? paymentVerified : (snap.data()?.paymentVerified ?? false),
    approvedBy: adminUid,
    updatedAt: new Date().toISOString(),
  });

  if (decision === 'approve') {
    await pushToTechnician(technicianId, {
      title: 'Account activated',
      body: 'Your AgriSahaya account is verified — you can now receive jobs.',
      data: { type: 'account-activated' },
    });
  }

  return { status: 'ok' };
});

/** Admin toggles an already-reviewed technician between active and inactive. */
export const setTechnicianStatus = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { technicianId, status } = request.data ?? {};
  const allowed = ['active', 'inactive'];

  if (typeof technicianId !== 'string' || !allowed.includes(status)) {
    throw new HttpsError('invalid-argument', 'technicianId and a valid status ("active" or "inactive") are required.');
  }

  const ref = db.collection('technicians').doc(technicianId);
  const snap = await requireDoc(ref, 'Mechanic not found.');

  if (!allowed.includes(snap.data()?.status)) {
    throw new HttpsError(
      'failed-precondition',
      'Only an already-approved mechanic can be toggled this way — use reviewSignup for a pending one.',
    );
  }

  await ref.update({
    approvedBy: adminUid,
    updatedAt: new Date().toISOString(),
  });

  return { status: 'ok' };
});

/** Self-service: a signed-in technician registers/refreshes their push token. */
export const updateDeviceInfo = onCall(async (request) => {
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const fcmToken = request.data?.fcmToken;

  if (typeof fcmToken !== 'string' || !fcmToken) {
    throw new HttpsError('invalid-argument', 'fcmToken is required.');
  }

  await db.collection('technicians').doc(uid).update({
    fcmToken,
    updatedAt: new Date().toISOString(),
  });

  return { status: 'ok' };
});

/**
 * Best-effort single-device enforcement: called once right after any
 * successful phone-OTP sign-in (fresh signup or returning login alike).
 * Revokes every refresh token issued before now for this uid, forcing any
 * other device's session to re-authenticate on its next token refresh.
 *
 * Two accepted tradeoffs, not closed here:
 * - `revokeRefreshTokens` doesn't invalidate an already-issued ID token — an
 *   old device's session can keep calling functions for up to its ~1hr
 *   natural expiry. Checking `checkRevoked` on every call would close this
 *   gap but adds an Auth/Firestore lookup to every request in the app — not
 *   worth it at this app's scale/threat model.
 * - This also revokes the tokens the just-signed-in device itself was
 *   issued a moment earlier (second-granularity `iat` can tie with the
 *   revocation cutoff). Callers must force a fresh ID token right after this
 *   resolves (`auth.currentUser?.getIdToken(true)`) so this device's own
 *   session survives.
 *
 * Best-effort like the push helpers in lib/push.ts: this single-device
 * enforcement is a nice-to-have, not the thing that authenticates the
 * caller, so a failure here (including, as observed, the Auth emulator
 * occasionally erroring on revokeRefreshTokens) must never block an
 * otherwise-successful sign-in.
 */
export const revokeOtherSessions = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  try {
    await auth.revokeRefreshTokens(uid);
  } catch (err) {
    console.warn(`revokeOtherSessions failed for ${uid}:`, err);
  }

  return { status: 'ok' };
});

const ADMIN_EDITABLE_FIELDS = [
  'fullName',
  'village',
  'district',
  'state',
  'pincode',
  'address',
  'landmark',
  'age',
  'experience',
] as const;

/** Admin edits a technician's profile fields directly (phone number and status are not editable here). */
export const adminUpdateProfile = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { technicianId, profile } = request.data ?? {};

  if (typeof technicianId !== 'string' || !profile || typeof profile !== 'object') {
    throw new HttpsError('invalid-argument', 'technicianId and profile are required.');
  }

  const ref = db.collection('technicians').doc(technicianId);
  const snap = await requireDoc(ref, 'Mechanic not found.');

  const updates: Record<string, string> = {};
  for (const field of ADMIN_EDITABLE_FIELDS) {
    const value = (profile as Record<string, unknown>)[field];
    if (value === undefined) continue;
    if (typeof value !== 'string') {
      throw new HttpsError('invalid-argument', `"${field}" must be text.`);
    }
    updates[field] = value.trim();
  }

  try {
    assertValidProfile({ ...(snap.data() as ProfileInput), ...updates });
  } catch (err) {
    throw new HttpsError('invalid-argument', err instanceof Error ? err.message : 'Invalid profile.');
  }

  await ref.update({ ...updates, editedBy: adminUid, updatedAt: new Date().toISOString() });

  return { status: 'ok' };
});
