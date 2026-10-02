import { applicationDefault } from 'firebase-admin/app';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { requireAdmin, requireUid } from './lib/authz';
import { requireDoc } from './lib/docHelpers';
import { auth, db } from './lib/firebaseAdmin';
import { historyEntry } from './lib/jobHistory';
import { jobRef } from './lib/jobs';
import { applyStatsDelta } from './lib/jobStats';
import { isHeld, statusStamp } from './lib/jobStatus';
import * as notify from './lib/notifications';
import { onCall } from './lib/onCall';
import { currentProfileVersion, recordProfileEdit } from './lib/profileEdits';
import { pushToTechnician } from './lib/push';
import { optionalTrimmed, requireString } from './lib/request';
import { getSettings } from './lib/settings';
import { SMS_SECRETS, sendSms } from './lib/sms';
import { technicianRef } from './lib/technicians';
import { parseProfileUpdates, requireValidProfile, type ProfileField, type ProfileInput } from './lib/validation';

/** Admin approves or rejects a pending technician. This is the activation gate. */
export const reviewSignup = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const technicianId = requireString(request.data, 'technicianId', 'technicianId and a valid decision are required.');
  const { decision, paymentVerified, reason } = request.data;

  if (decision !== 'approve' && decision !== 'reject') {
    throw new HttpsError('invalid-argument', 'technicianId and a valid decision are required.');
  }

  const ref = technicianRef(technicianId);
  const snap = await requireDoc(ref, 'Mechanic not found.');

  if (snap.data()?.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'This mechanic has already been reviewed.');
  }

  const now = new Date().toISOString();
  const approved = decision === 'approve';
  const rejectionReason = approved ? null : optionalTrimmed(reason)?.slice(0, 300) ?? null;

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

  if (!approved) return { status: 'ok', sms: null };

  await pushToTechnician(technicianId, notify.accountActivated());
  // Best-effort like the push: a failed SMS never undoes the approval. Its outcome goes back to the admin, who can
  // restart the gateway or send it from their own phone.
  const { supportPhoneNumber } = await getSettings();
  const sms = await sendSms(String(snap.data()?.phoneNumber), notify.accountActivatedSms(String(snap.data()?.fullName ?? ''), supportPhoneNumber));

  return { status: 'ok', sms };
}, { secrets: SMS_SECRETS });

/** Admin toggles an already-reviewed technician between active and inactive. */
export const setTechnicianStatus = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const message = 'technicianId and a valid status ("active" or "inactive") are required.';
  const technicianId = requireString(request.data, 'technicianId', message);
  const { status } = request.data;
  const allowed = ['active', 'inactive'];

  if (!allowed.includes(status)) {
    throw new HttpsError('invalid-argument', message);
  }

  const ref = technicianRef(technicianId);
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
    const jobs = await Promise.all(heldJobIds.map((id) => tx.get(jobRef(id))));
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

    tx.update(ref, {
      status,
      approvedBy: adminUid,
      updatedAt: now,
      ...(stillHeld.length ? { jobStats: applyStatsDelta(technician.data()?.jobStats, { pending: -stillHeld.length }) } : {}),
    });

    return stillHeld.length;
  });

  if (released > 0) await pushToTechnician(technicianId, notify.jobsReleased(released));

  return { status: 'ok', released };
});

/** Self-service: a signed-in technician registers/refreshes their push token. */
export const updateDeviceInfo = onCall(async (request) => {
  const uid = requireUid(request);
  const fcmToken = requireString(request.data, 'fcmToken');

  await technicianRef(uid).update({
    fcmToken,
    updatedAt: new Date().toISOString(),
  });

  return { status: 'ok' };
});

/**
 * Revokes every refresh token issued before `validSince` (Unix seconds). The Admin SDK's
 * `revokeRefreshTokens` only ever uses "now", so this sets the same account field through the
 * Identity Toolkit API directly.
 */
async function revokeRefreshTokensBefore(uid: string, validSince: number): Promise<void> {
  const { access_token } = await applicationDefault().getAccessToken();
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${process.env.GCLOUD_PROJECT}/accounts:update`, {
    method: 'POST',
    headers: { authorization: `Bearer ${access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ localId: uid, validSince: String(validSince) }),
  });
  if (!response.ok) throw new Error(`accounts:update failed (${response.status}): ${await response.text()}`);
}

/**
 * Best-effort single-device enforcement: called once right after any
 * successful phone-OTP sign-in (fresh signup or returning login alike).
 * Revokes every refresh token issued before this sign-in (the caller's
 * `auth_time`), forcing any other device's session to re-authenticate on its
 * next token refresh.
 *
 * The cutoff is the caller's sign-in time, not "now": revoking at "now"
 * (`revokeRefreshTokens`) also revokes the refresh token this device was
 * issued a second or more earlier, and its next refresh then fails with
 * auth/user-token-expired — every login over a real network hit that.
 *
 * Accepted tradeoff, not closed here: revoking doesn't invalidate an
 * already-issued ID token — an old device's session can keep calling
 * functions for up to its ~1hr natural expiry. Checking `checkRevoked` on
 * every call would close this gap but adds an Auth/Firestore lookup to every
 * request in the app — not worth it at this app's scale/threat model.
 *
 * Best-effort like the push helpers in lib/push.ts: this single-device
 * enforcement is a nice-to-have, not the thing that authenticates the
 * caller, so a failure here (including, as observed, the Auth emulator
 * occasionally erroring on revokeRefreshTokens) must never block an
 * otherwise-successful sign-in.
 */
export const revokeOtherSessions = onCall(async (request) => {
  const uid = requireUid(request);

  try {
    // The emulator has no real Identity Toolkit endpoint to call; local sign-ins are one device anyway.
    if (process.env.FUNCTIONS_EMULATOR === 'true') await auth.revokeRefreshTokens(uid);
    else await revokeRefreshTokensBefore(uid, request.auth!.token.auth_time);
  } catch (err) {
    console.warn(`revokeOtherSessions failed for ${uid}:`, err);
  }

  return { status: 'ok' };
});

/**
 * Writes a profile edit and its version-history entry (lib/profileEdits.ts) in one transaction. `assertCanEdit` runs
 * against the current record before anything is written. Returns the record's profile version after the call —
 * unchanged when the edit didn't actually change any value.
 */
async function applyProfileEdit(
  technicianId: string,
  updates: Partial<Record<ProfileField, string>>,
  source: 'technician' | 'admin',
  editedBy: string,
  assertCanEdit?: (technician: DocumentData) => void,
) {
  const settings = await getSettings();
  const ref = technicianRef(technicianId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const before = snap.data();

    if (!before) {
      throw new HttpsError('not-found', 'Mechanic not found.');
    }
    assertCanEdit?.(before);
    requireValidProfile({ ...(before as ProfileInput), ...updates }, settings);

    const now = new Date().toISOString();
    const version = recordProfileEdit(tx, technicianId, before, updates, source, editedBy, now);

    if (version === null) {
      return { status: 'unchanged' as const, profileVersion: currentProfileVersion(before) };
    }

    tx.update(ref, { ...updates, profileVersion: version, editedBy, updatedAt: now });

    return { status: 'ok' as const, profileVersion: version };
  });
}

/** Admin edits a technician's profile fields (never phone number, status or paymentVerified — see parseProfileUpdates). */
export const adminUpdateProfile = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const technicianId = requireString(request.data, 'technicianId', 'technicianId and profile are required.');
  const updates = parseProfileUpdates(request.data.profile);

  return applyProfileEdit(technicianId, updates, 'admin', adminUid);
});

/**
 * Technician edits their own profile fields — the same fields an admin can, nothing more (see parseProfileUpdates).
 * The target is always the caller's own record: the uid comes from the verified ID token, never from request.data, so
 * one technician can't write another's profile. Only an active technician can edit; pending/rejected ones change their
 * details through reapplySignup, and a deactivated one can't at all.
 */
export const updateOwnProfile = onCall(async (request) => {
  const uid = requireUid(request);
  const updates = parseProfileUpdates(request.data?.profile);

  return applyProfileEdit(uid, updates, 'technician', uid, (technician) => {
    if (technician.status !== 'active') {
      throw new HttpsError('permission-denied', 'Only an active mechanic can edit their profile.');
    }
  });
});
