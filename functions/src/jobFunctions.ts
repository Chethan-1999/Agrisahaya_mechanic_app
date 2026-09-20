import { FieldValue, type DocumentReference, type DocumentSnapshot, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAdmin } from './lib/authz';
import { db } from './lib/firebaseAdmin';
import { historyEntry } from './lib/jobHistory';
import { isAwaitingResponse, isDeletable, isFinished, isHeld, statusStamp, type JobStatus } from './lib/jobStatus';
import { pushToTechnician } from './lib/push';

type JobStatsDelta = Partial<Record<'pending' | 'completed' | 'cancelled' | 'deleted', number>>;

type JobDoc = {
  technicianId: string | null;
  status: JobStatus;
  jobCode?: string;
  description: string;
  deleted?: boolean;
  /** Set when the job was taken back from a deactivated technician; cleared as soon as it is assigned again. */
  needsReassignment?: boolean;
};

const technicianRef = (id: string) => db.collection('technicians').doc(id);

/** Reads a job inside a transaction. A soft-deleted job is treated as gone. */
async function readJob(tx: Transaction, ref: DocumentReference): Promise<JobDoc> {
  const snap = await tx.get(ref);
  const data = snap.data() as JobDoc | undefined;

  if (!snap.exists || !data || data.deleted) {
    throw new HttpsError('not-found', 'Job not found.');
  }

  return data;
}

/** Reads a technician inside a transaction; every read in a transaction has to happen before its first write. */
const readTechnician = (tx: Transaction, id: string) => tx.get(technicianRef(id));

/** Applies counter deltas to a technician's `jobStats` (never below zero). A missing technician is skipped. */
function writeStats(tx: Transaction, snap: DocumentSnapshot, delta: JobStatsDelta): void {
  if (!snap.exists) return;

  const stats = (snap.data()?.jobStats ?? { pending: 0, completed: 0, cancelled: 0, deleted: 0 }) as Record<string, number>;
  const next = { ...stats };

  for (const [key, value] of Object.entries(delta)) {
    next[key] = Math.max(0, (next[key] ?? 0) + (value ?? 0));
  }

  tx.update(snap.ref, { jobStats: next });
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

/** Short label for a push body: the human-readable code when the job has one, else a generic phrase. */
const jobLabel = (job: Pick<JobDoc, 'jobCode'>) => (job.jobCode ? `Job ${job.jobCode}` : 'A job');

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Human-readable id like "#26091901" (YYMMDD + per-day sequence), allocated in a transaction so concurrent creates never collide.
 * The day is the India day: Cloud Functions run in UTC, so using the server's own clock would date a job created
 * before 05:30 IST with the previous day.
 */
async function nextJobCode(now: Date): Promise<string> {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const day = `${String(ist.getUTCFullYear()).slice(-2)}${String(ist.getUTCMonth() + 1).padStart(2, '0')}${String(ist.getUTCDate()).padStart(2, '0')}`;
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

  const now = new Date();
  const createdAt = now.toISOString();
  const jobCode = await nextJobCode(now);
  const description = describeJob(fields);
  const ref = db.collection('jobs').doc();

  await db.runTransaction(async (tx) => {
    const technician = isAssigning ? await readTechnician(tx, technicianId) : null;

    if (isAssigning && (!technician?.exists || technician.data()?.status !== 'active')) {
      throw new HttpsError('failed-precondition', 'Only an active mechanic can be assigned a job.');
    }

    tx.set(ref, {
      ...fields,
      jobCode,
      description,
      technicianId: isAssigning ? technicianId : null,
      status: isAssigning ? 'assigned' : 'open',
      createdAt,
      createdBy: adminUid,
      ...statusStamp(adminUid, 'admin'),
      deleted: false,
      needsReassignment: false,
      cancelledBy: null,
      cancelReason: null,
      acceptedAt: null,
      completedAt: null,
      history: [
        historyEntry('create', adminUid),
        ...(isAssigning ? [historyEntry('assign', adminUid, { technicianId })] : []),
      ],
    });

    if (technician) writeStats(tx, technician, { pending: 1 });
  });

  if (isAssigning) {
    await pushToTechnician(technicianId, {
      title: 'New job assigned',
      body: description.slice(0, 120),
      data: { type: 'job-assigned', jobId: ref.id },
    });
  }

  return { status: 'ok', jobId: ref.id, jobCode };
});

/** Admin edits the six entered fields. Finished jobs (completed/cancelled) are frozen; a technician holding the job is told. */
export const updateJob = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { jobId } = request.data ?? {};

  if (typeof jobId !== 'string') throw new HttpsError('invalid-argument', 'jobId is required.');

  const fields = parseJobFields(request.data);
  const ref = db.collection('jobs').doc(jobId);

  const job = await db.runTransaction(async (tx) => {
    const current = await readJob(tx, ref);

    if (isFinished(current.status)) {
      throw new HttpsError('failed-precondition', 'A finished job can no longer be edited.');
    }

    tx.update(ref, {
      ...fields,
      description: describeJob(fields),
      updatedBy: adminUid,
      updatedAt: new Date().toISOString(),
      history: FieldValue.arrayUnion(historyEntry('edit', adminUid)),
    });

    return current;
  });

  if (job.technicianId && isHeld(job.status)) {
    await pushToTechnician(job.technicianId, {
      title: 'Job details updated',
      body: `${jobLabel(job)} was updated by the admin. Open the job to see the changes.`,
      data: { type: 'job-updated', jobId },
    });
  }

  return { status: 'ok' };
});

/**
 * Admin removes a finished-with job from the boards. Only declined, cancelled or completed jobs can be deleted, and the
 * document is kept (flagged `deleted`) so both sides keep an accurate record: the job's own history stays intact and
 * the technician's `jobStats.deleted` goes up. Hidden from every list by the clients.
 */
export const deleteJob = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { jobId } = request.data ?? {};

  if (typeof jobId !== 'string') throw new HttpsError('invalid-argument', 'jobId is required.');

  const ref = db.collection('jobs').doc(jobId);

  await db.runTransaction(async (tx) => {
    const job = await readJob(tx, ref);

    if (!isDeletable(job.status)) {
      throw new HttpsError('failed-precondition', 'Only a declined, cancelled or completed job can be deleted. Cancel it first.');
    }

    const technician = job.technicianId ? await readTechnician(tx, job.technicianId) : null;
    const at = new Date().toISOString();

    tx.update(ref, {
      deleted: true,
      deletedAt: at,
      deletedBy: adminUid,
      ...statusStamp(adminUid, 'admin'),
      history: FieldValue.arrayUnion(historyEntry('delete', adminUid, { fromStatus: job.status })),
    });

    if (technician) writeStats(tx, technician, { deleted: 1 });
  });

  return { status: 'ok' };
});

/**
 * Admin assigns a job. An open job becomes `assigned`; a declined job, or one still held by another technician
 * (who must then accept again), becomes `reassigned`. `markCompleted` closes it in the same step, for a job that was
 * already done by phone — the two writes are one transaction so a half-applied assignment can't be left behind.
 */
export const assignJob = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { jobId, technicianId, markCompleted } = request.data ?? {};

  if (typeof jobId !== 'string' || typeof technicianId !== 'string' || !technicianId) {
    throw new HttpsError('invalid-argument', 'Job and mechanic are required.');
  }

  const ref = db.collection('jobs').doc(jobId);
  const completeNow = markCompleted === true;

  const { job, previousTechnicianId, previouslyHeld, nextStatus } = await db.runTransaction(async (tx) => {
    const current = await readJob(tx, ref);

    if (isFinished(current.status)) {
      throw new HttpsError('failed-precondition', 'A finished job cannot be (re)assigned.');
    }

    const previousId = current.technicianId;
    const held = isHeld(current.status);

    if (held && previousId === technicianId) {
      throw new HttpsError('failed-precondition', 'This job is already assigned to that mechanic.');
    }

    const nextTechnician = await readTechnician(tx, technicianId);
    const previousTechnician = held && previousId ? await readTechnician(tx, previousId) : null;

    if (!nextTechnician.exists || nextTechnician.data()?.status !== 'active') {
      throw new HttpsError('failed-precondition', 'Only an active mechanic can be assigned a job.');
    }

    // A job released from a deactivated technician is open again, but assigning it is still a reassignment.
    const isReassign = current.status !== 'open' || current.needsReassignment === true;
    const status: JobStatus = completeNow ? 'completed' : isReassign ? 'reassigned' : 'assigned';
    const now = new Date().toISOString();

    tx.update(ref, {
      technicianId,
      status,
      acceptedAt: null,
      needsReassignment: false,
      ...(completeNow ? { completedAt: now, completedByAdmin: true } : {}),
      ...statusStamp(adminUid, 'admin'),
      history: FieldValue.arrayUnion(
        historyEntry(isReassign ? 'reassign' : 'assign', adminUid, { technicianId, reassignedFrom: previousId }),
        ...(completeNow ? [historyEntry('complete', adminUid, { adminOverride: true })] : []),
      ),
    });

    writeStats(tx, nextTechnician, completeNow ? { completed: 1 } : { pending: 1 });
    if (previousTechnician) writeStats(tx, previousTechnician, { pending: -1 });

    return { job: current, previousTechnicianId: previousId, previouslyHeld: held, nextStatus: status };
  });

  // Tell the technician who just lost the job (a declined one already gave it up), then the one who received it.
  if (previousTechnicianId && previouslyHeld) {
    await pushToTechnician(previousTechnicianId, {
      title: 'Job reassigned',
      body: `${jobLabel(job)} has been reassigned to another mechanic.`,
      data: { type: 'job-reassigned', jobId },
    });
  }

  await pushToTechnician(technicianId, completeNow
    ? {
        title: 'Job completed',
        body: `${jobLabel(job)} was marked completed by the admin.`,
        data: { type: 'job-completed', jobId },
      }
    : {
        title: nextStatus === 'reassigned' ? 'Job reassigned to you' : 'New job assigned',
        body: job.description.slice(0, 120),
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

  const job = await db.runTransaction(async (tx) => {
    const current = await readJob(tx, ref);

    if (!isHeld(current.status) || !current.technicianId) {
      throw new HttpsError('failed-precondition', 'Only a job held by a mechanic can be marked complete.');
    }

    const technician = await readTechnician(tx, current.technicianId);

    tx.update(ref, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      completedByAdmin: true,
      ...statusStamp(adminUid, 'admin'),
      history: FieldValue.arrayUnion(historyEntry('complete', adminUid, { adminOverride: true })),
    });
    writeStats(tx, technician, { pending: -1, completed: 1 });

    return current;
  });

  await pushToTechnician(job.technicianId as string, {
    title: 'Job completed',
    body: `${jobLabel(job)} was marked completed by the admin.`,
    data: { type: 'job-completed', jobId },
  });

  return { status: 'ok' };
});

/** Loads the caller's own job inside a transaction, or throws if it isn't theirs. */
async function readOwnJob(tx: Transaction, uid: string, ref: DocumentReference): Promise<JobDoc> {
  const job = await readJob(tx, ref);

  if (job.technicianId !== uid) {
    throw new HttpsError('permission-denied', 'This is not your job.');
  }

  return job;
}

function requireTechnicianUid(request: { auth?: { uid: string } | undefined; data?: { jobId?: unknown } }) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const jobId = request.data?.jobId;
  if (typeof jobId !== 'string') throw new HttpsError('invalid-argument', 'jobId is required.');

  return { uid, jobId };
}

/** Technician accepts an assigned (or reassigned) job — the only status change they can make besides declining. */
export const acceptJob = onCall(async (request) => {
  const { uid, jobId } = requireTechnicianUid(request);
  const ref = db.collection('jobs').doc(jobId);

  await db.runTransaction(async (tx) => {
    const job = await readOwnJob(tx, uid, ref);

    if (!isAwaitingResponse(job.status)) {
      throw new HttpsError('failed-precondition', 'This job is no longer awaiting a response.');
    }

    tx.update(ref, {
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      ...statusStamp(uid, 'technician'),
      history: FieldValue.arrayUnion(historyEntry('accept', uid)),
    });
  });

  return { status: 'ok' };
});

/** Technician declines — hands the job back to the admin to reassign. Not the same as a cancellation. */
export const declineJob = onCall(async (request) => {
  const { uid, jobId } = requireTechnicianUid(request);
  const ref = db.collection('jobs').doc(jobId);

  await db.runTransaction(async (tx) => {
    const job = await readOwnJob(tx, uid, ref);

    if (!isAwaitingResponse(job.status)) {
      throw new HttpsError('failed-precondition', 'This job is no longer awaiting a response.');
    }

    const technician = await readTechnician(tx, uid);

    tx.update(ref, {
      status: 'declined',
      ...statusStamp(uid, 'technician'),
      history: FieldValue.arrayUnion(historyEntry('decline', uid)),
    });
    writeStats(tx, technician, { pending: -1 });
  });

  return { status: 'ok' };
});

/** Technician marks an accepted job done. */
export const completeJob = onCall(async (request) => {
  const { uid, jobId } = requireTechnicianUid(request);
  const ref = db.collection('jobs').doc(jobId);

  await db.runTransaction(async (tx) => {
    const job = await readOwnJob(tx, uid, ref);

    if (job.status !== 'accepted') {
      throw new HttpsError('failed-precondition', 'Only an accepted job can be marked complete.');
    }

    const technician = await readTechnician(tx, uid);

    tx.update(ref, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      ...statusStamp(uid, 'technician'),
      history: FieldValue.arrayUnion(historyEntry('complete', uid)),
    });
    writeStats(tx, technician, { pending: -1, completed: 1 });
  });

  return { status: 'ok' };
});

/** Admin-only. Reason is optional — cancelling doesn't require an explanation. Any job that isn't already finished can be cancelled. */
export const cancelJob = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { jobId, reason } = request.data ?? {};

  if (typeof jobId !== 'string') throw new HttpsError('invalid-argument', 'jobId is required.');

  const ref = db.collection('jobs').doc(jobId);
  const cancelReason = typeof reason === 'string' && reason.trim() ? reason.trim() : null;

  const job = await db.runTransaction(async (tx) => {
    const current = await readJob(tx, ref);

    if (isFinished(current.status)) {
      throw new HttpsError('failed-precondition', 'This job is already finished.');
    }

    const held = isHeld(current.status) && current.technicianId;
    const technician = held ? await readTechnician(tx, current.technicianId as string) : null;

    tx.update(ref, {
      status: 'cancelled',
      cancelledBy: adminUid,
      cancelReason,
      ...statusStamp(adminUid, 'admin'),
      history: FieldValue.arrayUnion(historyEntry('cancel', adminUid, { reason: cancelReason })),
    });

    // Only a technician who actually held the job gets it counted against them; one who already declined it doesn't.
    if (technician) writeStats(tx, technician, { pending: -1, cancelled: 1 });

    return current;
  });

  if (job.technicianId && isHeld(job.status)) {
    await pushToTechnician(job.technicianId, {
      title: 'Job cancelled',
      body: `${jobLabel(job)} assigned to you has been cancelled.`,
      data: { type: 'job-cancelled', jobId },
    });
  }

  return { status: 'ok' };
});
