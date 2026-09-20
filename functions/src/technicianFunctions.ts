import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAdmin } from './lib/authz';
import { requireDoc } from './lib/docHelpers';
import { auth, db } from './lib/firebaseAdmin';
import { historyEntry } from './lib/jobHistory';
import { isHeld, statusStamp } from './lib/jobStatus';
import { pushToTechnician } from './lib/push';
import { assertValidProfile, type ProfileInput } from './lib/validation';

/** Admin approves or rejects a pending technician. This is the activation gate. */
export const reviewSignup = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { technicianId, decision, paymentVerified, reason } = request.data ?? {};

  if (typeof technicianId !== 'string' || (decision !== 'approve' && decision !== 'reject')) {
    throw new HttpsError('invalid-argument', 'technicianId and a valid decision are required.');
  }

  const ref = db.collection('technicians').doc(technicianId);
  const snap = await requireDoc(ref, 'Mechanic not found.');

  if (snap.data()?.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'This mechanic has already been reviewed.');
  }

  const now = new Date().toISOString();
  const approved = decision === 'approve';
  const rejectionReason = !approved && typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 300) : null;

  await ref.update({
    status: approved ? 'active' : 'rejected',
    paymentVerified: typeof paymentVerified === 'boolean' ? paymentVerified : (snap.data()?.paymentVerified ?? false),
    ...(approved ? { approvedBy: adminUid } : {}),
    reviewedBy: adminUid,
    reviewedAt: now,
    rejectionReason,
    // Every decision is kept, so a technician who is rejected and re-applies several times leaves a full trail.
    reviewHistory: FieldValue.arrayUnion({ decision, by: adminUid, at: now, reason: rejectionReason }),
    updatedAt: now,
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

  // Deactivating takes back every job the technician still holds, in the same transaction as the status change.
  const heldJobIds = status === 'inactive'
    ? (await db.collection('jobs').where('technicianId', '==', technicianId).get()).docs
        .filter((doc) => !doc.data().deleted && isHeld(doc.data().status))
        .map((doc) => doc.id)
    : [];

  const released = await db.runTransaction(async (tx) => {
    const technician = await tx.get(ref);
    const jobs = await Promise.all(heldJobIds.map((id) => tx.get(db.collection('jobs').doc(id))));
    // Re-check inside the transaction: the job may have been declined, completed or moved since the query ran.
    const stillHeld = jobs.filter((job) => {
      const data = job.data();
      return data && !data.deleted && data.technicianId === technicianId && isHeld(data.status);
    });
    const now = new Date().toISOString();

    for (const job of stillHeld) {
      tx.update(job.ref, {
        status: 'open',
        technicianId: null,
        acceptedAt: null,
        needsReassignment: true,
        releasedFrom: technicianId,
        releasedAt: now,
        ...statusStamp(adminUid, 'admin'),
        history: FieldValue.arrayUnion(
          historyEntry('release', adminUid, { technicianId, reason: 'technician-deactivated', fromStatus: job.data()?.status }),
        ),
      });
    }

    const stats = (technician.data()?.jobStats ?? { pending: 0, completed: 0, cancelled: 0, deleted: 0 }) as Record<string, number>;

    tx.update(ref, {
      status,
      approvedBy: adminUid,
      updatedAt: now,
      ...(stillHeld.length ? { jobStats: { ...stats, pending: Math.max(0, (stats.pending ?? 0) - stillHeld.length) } } : {}),
    });

    return stillHeld.length;
  });

  if (released > 0) {
    await pushToTechnician(technicianId, {
      title: 'Jobs taken back',
      body: `Your account was deactivated, so ${released} job${released === 1 ? ' was' : 's were'} taken back and will be reassigned.`,
      data: { type: 'jobs-released' },
    });
  }

  return { status: 'ok', released };
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
