import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAdmin } from './lib/authz';
import { requireDoc } from './lib/docHelpers';
import { db } from './lib/firebaseAdmin';
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

/** Admin logs a call. With a technicianId it's assigned immediately; without one it's left "open" for assignJob later. */
export const createJob = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { technicianId, farmerName, farmerPhone, description } = request.data ?? {};

  if (typeof description !== 'string' || !description.trim()) {
    throw new HttpsError('invalid-argument', 'A job description is required.');
  }

  const isAssigning = typeof technicianId === 'string' && technicianId;
  if (isAssigning) {
    await requireActiveTechnician(technicianId);
  }

  const now = new Date().toISOString();
  const ref = db.collection('jobs').doc();

  await ref.set({
    technicianId: isAssigning ? technicianId : null,
    farmerName: typeof farmerName === 'string' ? farmerName.trim() : '',
    farmerPhone: typeof farmerPhone === 'string' ? farmerPhone.trim() : '',
    description: description.trim(),
    status: isAssigning ? 'assigned' : 'open',
    createdAt: now,
    createdBy: adminUid,
    cancelledBy: null,
    cancelReason: null,
  });

  if (isAssigning) {
    await bumpJobStats(technicianId, { pending: 1 });
    await pushToTechnician(technicianId, {
      title: 'New job assigned',
      body: description.trim().slice(0, 120),
      data: { type: 'job-assigned', jobId: ref.id },
    });
  }

  return { status: 'ok', jobId: ref.id };
});

/** Admin assigns (or re-assigns, after a decline) an open job to a technician. */
export const assignJob = onCall(async (request) => {
  await requireAdmin(request);
  const { jobId, technicianId } = request.data ?? {};

  if (typeof jobId !== 'string' || typeof technicianId !== 'string' || !technicianId) {
    throw new HttpsError('invalid-argument', 'jobId and technicianId are required.');
  }

  const ref = db.collection('jobs').doc(jobId);
  const snap = await requireDoc(ref, 'Job not found.');
  const data = snap.data() as { technicianId: string | null; status: string; description: string };

  if (data.status !== 'open' && data.status !== 'declined') {
    throw new HttpsError('failed-precondition', 'Only an open or declined job can be (re)assigned.');
  }

  await requireActiveTechnician(technicianId);

  const previousTechnicianId = data.technicianId;

  await ref.update({ technicianId, status: 'assigned' });
  await bumpJobStats(technicianId, { pending: 1 });

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

  await ref.update({ status: 'accepted' });
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

  await ref.update({ status: 'declined' });
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

  await ref.update({ status: 'completed' });
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

  await ref.update({
    status: 'cancelled',
    cancelledBy: adminUid,
    cancelReason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
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
