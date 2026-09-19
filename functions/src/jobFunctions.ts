import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAdmin } from './lib/authz';
import { requireDoc } from './lib/docHelpers';
import { db } from './lib/firebaseAdmin';
import { historyEntry } from './lib/jobHistory';
import { pushDismiss, pushToTechnician } from './lib/push';
import { requireActiveTechnician } from './lib/technicians';

type JobStatsDelta = Partial<Record<'pending' | 'completed' | 'cancelled', number>>;

async function bumpJobStats(technicianId: string, delta: JobStatsDelta): Promise<void> {
  const ref = db.collection('technicians').doc(technicianId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;

    const stats = (snap.data()?.jobStats ?? { pending: 0, completed: 0, cancelled: 0 }) as Record<string, number>;
    const next = { ...stats };

    for (const [key, value] of Object.entries(delta)) {
      next[key] = Math.max(0, (next[key] ?? 0) + (value ?? 0));
    }

    tx.update(ref, { jobStats: next });
  });
}

type JobFields = {
  farmerName: string;
  farmerPhone: string;
  equipment: string;
  issue: string;
  district: string;
  additionalNotes: string;
};

const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Validates the six admin-entered job fields; the client form checks the same rules, but never trust the client alone. */
function parseJobFields(data: Record<string, unknown>): JobFields {
  const fields: JobFields = {
    farmerName: trimmed(data.farmerName),
    farmerPhone: trimmed(data.farmerPhone),
    equipment: trimmed(data.equipment),
    issue: trimmed(data.issue),
    district: trimmed(data.district),
    additionalNotes: trimmed(data.additionalNotes),
  };

  if (!fields.farmerName || !fields.farmerPhone || !fields.equipment || !fields.issue || !fields.district) {
    throw new HttpsError('invalid-argument', 'Customer name, phone number, equipment, issue, and district are required.');
  }
  if (!/^\d{10}$/.test(fields.farmerPhone)) {
    throw new HttpsError('invalid-argument', 'Phone number must be exactly 10 digits.');
  }

  return fields;
}

/** `description` stays a single derived line so technician screens and push bodies keep working for every job. */
const describeJob = ({ equipment, issue }: Pick<JobFields, 'equipment' | 'issue'>) => `${equipment} — ${issue}`;

/** Human-readable id like "#26091901" (YYMMDD + per-day sequence), allocated in a transaction so concurrent creates never collide. */
async function nextJobCode(now: Date): Promise<string> {
  const day = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const ref = db.collection('counters').doc(`jobs-${day}`);

  const sequence = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number | undefined) ?? 0) + 1;
    tx.set(ref, { value: next });
    return next;
  });

  return `#${day}${String(sequence).padStart(2, '0')}`;
}

/** Admin logs a call. With a technicianId it's assigned immediately; without one it's left "open" for assignJob later. */
export const createJob = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const data = request.data ?? {};
  const fields = parseJobFields(data);
  const { technicianId } = data;

  const isAssigning = typeof technicianId === 'string' && technicianId;
  if (isAssigning) {
    await requireActiveTechnician(technicianId);
  }

  const now = new Date();
  const createdAt = now.toISOString();
  const jobCode = await nextJobCode(now);
  const description = describeJob(fields);
  const ref = db.collection('jobs').doc();

  await ref.set({
    ...fields,
    jobCode,
    description,
    technicianId: isAssigning ? technicianId : null,
    status: isAssigning ? 'assigned' : 'open',
    createdAt,
    createdBy: adminUid,
    cancelledBy: null,
    cancelReason: null,
    acceptedAt: null,
    completedAt: null,
    history: isAssigning
      ? [historyEntry('create', adminUid, { technicianId }), historyEntry('assign', adminUid, { technicianId })]
      : [historyEntry('create', adminUid, { technicianId: null })],
  });

  if (isAssigning) {
    await bumpJobStats(technicianId, { pending: 1 });
    await pushToTechnician(technicianId, {
      title: 'New job assigned',
      body: description.slice(0, 120),
      data: { type: 'job-assigned', jobId: ref.id },
    });
  }

  return { status: 'ok', jobId: ref.id, jobCode };
});

/** Admin edits the six entered fields. Finished jobs (completed/cancelled) are frozen. */
export const updateJob = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { jobId } = request.data ?? {};

  if (typeof jobId !== 'string') throw new HttpsError('invalid-argument', 'jobId is required.');

  const fields = parseJobFields(request.data);
  const ref = db.collection('jobs').doc(jobId);
  const snap = await requireDoc(ref, 'Job not found.');
  const data = snap.data() as { status: string };

  if (data.status === 'completed' || data.status === 'cancelled') {
    throw new HttpsError('failed-precondition', 'A finished job can no longer be edited.');
  }

  await ref.update({
    ...fields,
    description: describeJob(fields),
    history: FieldValue.arrayUnion(historyEntry('edit', adminUid)),
  });

  return { status: 'ok' };
});

/**
 * Admin removes a job. A completed job stays (it backs the technician's completed count and history);
 * one still held by a technician releases that technician's pending count and clears their notification.
 */
export const deleteJob = onCall(async (request) => {
  await requireAdmin(request);
  const { jobId } = request.data ?? {};

  if (typeof jobId !== 'string') throw new HttpsError('invalid-argument', 'jobId is required.');

  const ref = db.collection('jobs').doc(jobId);
  const snap = await requireDoc(ref, 'Job not found.');
  const data = snap.data() as { technicianId: string | null; status: string };

  if (data.status === 'completed') {
    throw new HttpsError('failed-precondition', 'A completed job cannot be deleted.');
  }

  await ref.delete();

  if (data.technicianId && (data.status === 'assigned' || data.status === 'accepted')) {
    await bumpJobStats(data.technicianId, { pending: -1 });
    await pushDismiss(data.technicianId, jobId);
  }

  return { status: 'ok' };
});

/** Admin assigns an open job, or re-assigns one that was declined or is still held by another technician (who must accept again). */
export const assignJob = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { jobId, technicianId } = request.data ?? {};

  if (typeof jobId !== 'string' || typeof technicianId !== 'string' || !technicianId) {
    throw new HttpsError('invalid-argument', 'jobId and technicianId are required.');
  }

  const ref = db.collection('jobs').doc(jobId);
  const snap = await requireDoc(ref, 'Job not found.');
  const data = snap.data() as { technicianId: string | null; status: string; description: string };

  if (data.status === 'completed' || data.status === 'cancelled') {
    throw new HttpsError('failed-precondition', 'A finished job cannot be (re)assigned.');
  }

  const previousTechnicianId = data.technicianId;
  const previouslyHeld = data.status === 'assigned' || data.status === 'accepted';

  if (previouslyHeld && previousTechnicianId === technicianId) {
    throw new HttpsError('failed-precondition', 'This job is already assigned to that technician.');
  }

  await requireActiveTechnician(technicianId);

  await ref.update({
    technicianId,
    status: 'assigned',
    acceptedAt: null,
    history: FieldValue.arrayUnion(historyEntry('assign', adminUid, { technicianId, reassignedFrom: previousTechnicianId })),
  });
  await bumpJobStats(technicianId, { pending: 1 });

  // A declined job already released its pending count in declineJob; a held one releases it here.
  if (previousTechnicianId && previouslyHeld) {
    await bumpJobStats(previousTechnicianId, { pending: -1 });
  }
  if (previousTechnicianId && previousTechnicianId !== technicianId) {
    await pushDismiss(previousTechnicianId, jobId);
  }

  await pushToTechnician(technicianId, {
    title: 'New job assigned',
    body: data.description.slice(0, 120),
    data: { type: 'job-assigned', jobId },
  });

  return { status: 'ok' };
});

/** Admin closes a job on the technician's behalf (e.g. done by phone). Same end state and stats as completeJob, flagged in history. */
export const completeJobAsAdmin = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { jobId } = request.data ?? {};

  if (typeof jobId !== 'string') throw new HttpsError('invalid-argument', 'jobId is required.');

  const ref = db.collection('jobs').doc(jobId);
  const snap = await requireDoc(ref, 'Job not found.');
  const data = snap.data() as { technicianId: string | null; status: string };

  if ((data.status !== 'assigned' && data.status !== 'accepted') || !data.technicianId) {
    throw new HttpsError('failed-precondition', 'Only a job held by a technician can be marked complete.');
  }

  await ref.update({
    status: 'completed',
    completedAt: new Date().toISOString(),
    history: FieldValue.arrayUnion(historyEntry('complete', adminUid, { adminOverride: true })),
  });
  await bumpJobStats(data.technicianId, { pending: -1, completed: 1 });
  await pushDismiss(data.technicianId, jobId);

  return { status: 'ok' };
});

async function requireOwnAssignedJob(uid: string, jobId: string) {
  const ref = db.collection('jobs').doc(jobId);
  const snap = await requireDoc(ref, 'Job not found.');
  const data = snap.data() as { technicianId: string | null; status: string };

  if (data.technicianId !== uid) {
    throw new HttpsError('permission-denied', 'This is not your job.');
  }

  return { ref, data };
}

/** Technician accepts an assigned job — the only status change they can make besides declining. */
export const acceptJob = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const jobId = request.data?.jobId;
  if (typeof jobId !== 'string') throw new HttpsError('invalid-argument', 'jobId is required.');

  const { ref, data } = await requireOwnAssignedJob(uid, jobId);

  if (data.status !== 'assigned') {
    throw new HttpsError('failed-precondition', 'This job is no longer awaiting a response.');
  }

  await ref.update({
    status: 'accepted',
    acceptedAt: new Date().toISOString(),
    history: FieldValue.arrayUnion(historyEntry('accept', uid)),
  });
  return { status: 'ok' };
});

/** Technician declines — hands the job back to the admin to reassign. Not the same as a cancellation. */
export const declineJob = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const jobId = request.data?.jobId;
  if (typeof jobId !== 'string') throw new HttpsError('invalid-argument', 'jobId is required.');

  const { ref, data } = await requireOwnAssignedJob(uid, jobId);

  if (data.status !== 'assigned') {
    throw new HttpsError('failed-precondition', 'This job is no longer awaiting a response.');
  }

  await ref.update({
    status: 'declined',
    history: FieldValue.arrayUnion(historyEntry('decline', uid)),
  });
  await bumpJobStats(uid, { pending: -1 });

  return { status: 'ok' };
});

/** Technician marks an accepted job done. */
export const completeJob = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const jobId = request.data?.jobId;
  if (typeof jobId !== 'string') throw new HttpsError('invalid-argument', 'jobId is required.');

  const { ref, data } = await requireOwnAssignedJob(uid, jobId);

  if (data.status !== 'accepted') {
    throw new HttpsError('failed-precondition', 'Only an accepted job can be marked complete.');
  }

  await ref.update({
    status: 'completed',
    completedAt: new Date().toISOString(),
    history: FieldValue.arrayUnion(historyEntry('complete', uid)),
  });
  await bumpJobStats(uid, { pending: -1, completed: 1 });

  return { status: 'ok' };
});

/** Admin-only. Reason is optional — cancelling doesn't require an explanation. */
export const cancelJob = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { jobId, reason } = request.data ?? {};

  if (typeof jobId !== 'string') throw new HttpsError('invalid-argument', 'jobId is required.');

  const ref = db.collection('jobs').doc(jobId);
  const snap = await requireDoc(ref, 'Job not found.');
  const data = snap.data() as { technicianId: string | null; status: string };

  if (data.status === 'completed' || data.status === 'cancelled') {
    throw new HttpsError('failed-precondition', 'This job is already finished.');
  }

  const cancelReason = typeof reason === 'string' && reason.trim() ? reason.trim() : null;

  await ref.update({
    status: 'cancelled',
    cancelledBy: adminUid,
    cancelReason,
    history: FieldValue.arrayUnion(historyEntry('cancel', adminUid, { reason: cancelReason })),
  });

  if (data.technicianId) {
    if (data.status === 'assigned' || data.status === 'accepted') {
      await bumpJobStats(data.technicianId, { pending: -1, cancelled: 1 });
    } else {
      await bumpJobStats(data.technicianId, { cancelled: 1 });
    }

    await pushDismiss(data.technicianId, jobId);
    await pushToTechnician(data.technicianId, {
      title: 'Job cancelled',
      body: 'A job assigned to you has been cancelled.',
      data: { type: 'job-cancelled', jobId },
    });
  }

  return { status: 'ok' };
});
