import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { requireAdmin, requireUid } from './lib/authz';
import { requireDoc } from './lib/docHelpers';
import { db } from './lib/firebaseAdmin';
import * as notify from './lib/notifications';
import { onCall } from './lib/onCall';
import { profileHistoryEntry } from './lib/profileHistory';
import { pushToAdmins, pushToTechnician } from './lib/push';
import { optionalTrimmed, requireString } from './lib/request';
import { getSettings } from './lib/settings';
import { technicianName, technicianRef } from './lib/technicians';
import { isProfileField } from './lib/validation';
import { isIndianState } from './shared/indianStates';

/** A technician never writes their own record — this is the only way a profile field changes. */
export const submitProfileUpdate = onCall(async (request) => {
  const uid = requireUid(request);
  const { changes } = request.data ?? {};
  const message = optionalTrimmed(request.data?.message);

  if (!message) {
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
    if (!isProfileField(field)) {
      throw new HttpsError('invalid-argument', `"${field}" cannot be changed this way.`);
    }
    if (typeof value !== 'string') {
      throw new HttpsError('invalid-argument', `"${field}" must be text.`);
    }
    if (field === 'state' && !isIndianState(value)) {
      throw new HttpsError('invalid-argument', 'Select a valid Indian state.');
    }
  }

  const technician = await requireDoc(technicianRef(uid), 'Mechanic profile not found.');

  const { count } = (
    await db.collection('profileUpdateRequests').where('technicianId', '==', uid).count().get()
  ).data();

  const { profileUpdateLifetimeCap } = await getSettings();

  if (count >= profileUpdateLifetimeCap) {
    throw new HttpsError(
      'resource-exhausted',
      `You've used all ${profileUpdateLifetimeCap} profile-change requests allowed for this account.`,
    );
  }

  const ref = db.collection('profileUpdateRequests').doc();
  await ref.set({
    technicianId: uid,
    changes,
    message,
    status: 'pending',
    createdAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
  });

  await pushToAdmins(notify.profileChangeRequested(ref.id, technicianName(technician), entries.map(([field]) => field)));

  return { status: 'submitted', requestId: ref.id };
});

/** Admin approves (applies the diff) or rejects (with a note) a pending profile-change request. */
export const reviewProfileUpdate = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const requestId = requireString(request.data, 'requestId', 'requestId and a valid decision are required.');
  const { decision } = request.data;

  if (decision !== 'approve' && decision !== 'reject') {
    throw new HttpsError('invalid-argument', 'requestId and a valid decision are required.');
  }

  const ref = db.collection('profileUpdateRequests').doc(requestId);
  const snap = await requireDoc(ref, 'Request not found.');
  const data = snap.data() as { technicianId: string; changes: Record<string, string>; status: string };

  if (data.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'This request has already been reviewed.');
  }

  const now = new Date().toISOString();
  const note = optionalTrimmed(request.data.adminNote);

  if (decision === 'approve') {
    const technician = technicianRef(data.technicianId);
    const before = (await requireDoc(technician, 'Mechanic not found.')).data() ?? {};

    const diffChanges: Record<string, { from: unknown; to: unknown }> = {};
    for (const [field, to] of Object.entries(data.changes)) {
      const from = before[field] ?? null;
      if (from !== to) diffChanges[field] = { from, to };
    }

    await technician.update({
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

  await pushToTechnician(data.technicianId, notify.profileChangeReviewed(requestId, decision === 'approve', note));

  return { status: 'ok' };
});
