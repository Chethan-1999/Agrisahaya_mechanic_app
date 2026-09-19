import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAdmin } from './lib/authz';
import { requireDoc } from './lib/docHelpers';
import { db } from './lib/firebaseAdmin';
import { isIndianState } from './lib/indianStates';
import { PROFILE_UPDATE_LIFETIME_CAP } from './lib/params';
import { profileHistoryEntry } from './lib/profileHistory';
import { pushToTechnician } from './lib/push';

// Mirrors MechanicForm's keys (src/types.ts) minus phoneNumber, which is
// never technician-editable. Kept as a plain list rather than a shared
// package across the two separate TS projects (functions/ and src/) — one
// small, rarely-changing array isn't worth a shared-types package at this
// project's size; see the DRY/YAGNI note in the Blueprint.
const EDITABLE_FIELDS = [
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

type EditableField = (typeof EDITABLE_FIELDS)[number];

/** A technician never writes their own record — this is the only way a profile field changes. */
export const submitProfileUpdate = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const { changes, message } = request.data ?? {};

  if (typeof message !== 'string' || !message.trim()) {
    throw new HttpsError('invalid-argument', 'A reason for the change is required.');
  }

  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw new HttpsError('invalid-argument', 'changes must be an object of field -> new value.');
  }

  const entries = Object.entries(changes as Record<string, unknown>);

  if (entries.length === 0) {
    throw new HttpsError('invalid-argument', 'No changes were provided.');
  }

  for (const [field, value] of entries) {
    if (!EDITABLE_FIELDS.includes(field as EditableField)) {
      throw new HttpsError('invalid-argument', `"${field}" cannot be changed this way.`);
    }
    if (typeof value !== 'string') {
      throw new HttpsError('invalid-argument', `"${field}" must be text.`);
    }
    if (field === 'state' && !isIndianState(value)) {
      throw new HttpsError('invalid-argument', 'Select a valid Indian state.');
    }
  }

  await requireDoc(db.collection('technicians').doc(uid), 'Technician profile not found.');

  const { count } = (
    await db.collection('profileUpdateRequests').where('technicianId', '==', uid).count().get()
  ).data();

  if (count >= PROFILE_UPDATE_LIFETIME_CAP.value()) {
    throw new HttpsError(
      'resource-exhausted',
      `You've used all ${PROFILE_UPDATE_LIFETIME_CAP.value()} profile-change requests allowed for this account.`,
    );
  }

  const ref = db.collection('profileUpdateRequests').doc();
  await ref.set({
    technicianId: uid,
    changes,
    message: message.trim(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
  });

  return { status: 'submitted', requestId: ref.id };
});

/** Admin approves (applies the diff) or rejects (with a note) a pending profile-change request. */
export const reviewProfileUpdate = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { requestId, decision, adminNote } = request.data ?? {};

  if (typeof requestId !== 'string' || (decision !== 'approve' && decision !== 'reject')) {
    throw new HttpsError('invalid-argument', 'requestId and a valid decision are required.');
  }

  const ref = db.collection('profileUpdateRequests').doc(requestId);
  const snap = await requireDoc(ref, 'Request not found.');
  const data = snap.data() as { technicianId: string; changes: Record<string, string>; status: string };

  if (data.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'This request has already been reviewed.');
  }

  const now = new Date().toISOString();
  const note = typeof adminNote === 'string' && adminNote.trim() ? adminNote.trim() : null;

  if (decision === 'approve') {
    const technicianRef = db.collection('technicians').doc(data.technicianId);
    const before = (await requireDoc(technicianRef, 'Technician not found.')).data() ?? {};

    const diffChanges: Record<string, { from: unknown; to: unknown }> = {};
    for (const [field, to] of Object.entries(data.changes)) {
      const from = before[field] ?? null;
      if (from !== to) diffChanges[field] = { from, to };
    }

    await technicianRef.update({
      ...data.changes,
      updatedAt: now,
      profileHistory: FieldValue.arrayUnion(profileHistoryEntry(adminUid, requestId, diffChanges)),
    });
  }

  await ref.update({
    status: decision === 'approve' ? 'approved' : 'rejected',
    reviewedBy: adminUid,
    reviewedAt: now,
    adminNote: note,
  });

  await pushToTechnician(data.technicianId, {
    title: decision === 'approve' ? 'Profile update approved' : 'Profile update needs changes',
    body:
      decision === 'approve'
        ? 'Your requested changes are now live on your profile.'
        : note ?? 'Your admin rejected this change — open the app for details.',
    data: { type: 'profile-update-reviewed', requestId },
  });

  return { status: 'ok' };
});
