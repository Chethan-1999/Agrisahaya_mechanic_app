import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { requireAdmin, requireUid } from './lib/authz';
import { db } from './lib/firebaseAdmin';
import { historyEntry, type JobAction } from './lib/jobHistory';
import { describeJob, jobRef, jobResult, nextJobCode, parseJobFields, readJob, readOwnJob, readTechnician } from './lib/jobs';
import { writeStats, type JobStatsDelta } from './lib/jobStats';
import { isAwaitingResponse, isFinished, isHeld, statusStamp, type JobStatus } from './lib/jobStatus';
import * as notify from './lib/notifications';
import { onCall } from './lib/onCall';
import { pushToAdmins, pushToTechnician } from './lib/push';
import { optionalTrimmed, requireString } from './lib/request';
import { assertActiveTechnician, technicianName } from './lib/technicians';

/** Admin logs a call. With a technicianId it's assigned immediately; without one it's left "open" for assignJob later. */
export const createJob = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const fields = parseJobFields(request.data);
  const technicianId = optionalTrimmed(request.data?.technicianId);

  const now = new Date();
  const jobCode = await nextJobCode(now);
  const description = describeJob(fields);
  const ref = db.collection('jobs').doc();

  await db.runTransaction(async (tx) => {
    const technician = technicianId ? await readTechnician(tx, technicianId) : null;

    if (technicianId) assertActiveTechnician(technician);

    tx.set(ref, {
      ...fields,
      jobCode,
      description,
      technicianId,
      status: technicianId ? 'assigned' : 'open',
      createdAt: now.toISOString(),
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
        ...(technicianId ? [historyEntry('assign', adminUid, { technicianId })] : []),
      ],
    });

    if (technician) writeStats(tx, technician, { pending: 1 });
  });

  if (technicianId) await pushToTechnician(technicianId, notify.jobAssigned(ref.id, description));

  return { ...(await jobResult(ref)), jobId: ref.id, jobCode };
});

/** Admin edits the six entered fields. Finished jobs (completed/cancelled) are frozen; a technician holding the job is told. */
export const updateJob = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const jobId = requireString(request.data, 'jobId');
  const fields = parseJobFields(request.data);
  const ref = jobRef(jobId);

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
    await pushToTechnician(job.technicianId, notify.jobDetailsUpdated(jobId, job));
  }

  return jobResult(ref);
});

/**
 * Admin assigns a job. An open job becomes `assigned`; a declined job, or one still held by another technician
 * (who must then accept again), becomes `reassigned`. `markCompleted` closes it in the same step, for a job that was
 * already done by phone — the two writes are one transaction so a half-applied assignment can't be left behind.
 */
export const assignJob = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const jobId = requireString(request.data, 'jobId', 'Job and mechanic are required.');
  const technicianId = requireString(request.data, 'technicianId', 'Job and mechanic are required.');
  const completeNow = request.data?.markCompleted === true;
  const ref = jobRef(jobId);

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

    assertActiveTechnician(nextTechnician);

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

  // Tell the technician who just lost the job (a declined one already gave it up) and the one who received it — sent
  // together, so the admin isn't kept waiting on two push sends back to back.
  await Promise.all([
    previousTechnicianId && previouslyHeld ? pushToTechnician(previousTechnicianId, notify.jobMovedToAnother(jobId, job)) : undefined,
    pushToTechnician(
      technicianId,
      completeNow ? notify.jobMarkedComplete(jobId, job) : notify.jobAssigned(jobId, job.description, nextStatus === 'reassigned'),
    ),
  ]);

  return jobResult(ref);
});

/** Admin closes a job on the technician's behalf (e.g. done by phone). Same end state and stats as completeJob, flagged in history. */
export const completeJobAsAdmin = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const jobId = requireString(request.data, 'jobId');
  const ref = jobRef(jobId);

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

  await pushToTechnician(job.technicianId as string, notify.jobMarkedComplete(jobId, job));

  return jobResult(ref);
});

/**
 * One of the three status changes a technician makes on their own job. They differ only in which status they start
 * from, what they write, how the counters move, and what the admins are told — the rest is the same transaction.
 */
function technicianJobAction(action: {
  allowedFrom: (status: JobStatus) => boolean;
  notAllowedMessage: string;
  nextStatus: JobStatus;
  history: JobAction;
  timestampField?: 'acceptedAt' | 'completedAt';
  stats?: JobStatsDelta;
  notifyAdmins: notify.TechnicianJobAction;
}) {
  return onCall(async (request) => {
    const uid = requireUid(request);
    const jobId = requireString(request.data, 'jobId');
    const ref = jobRef(jobId);

    const { job, technician } = await db.runTransaction(async (tx) => {
      const current = await readOwnJob(tx, uid, ref);

      if (!action.allowedFrom(current.status)) {
        throw new HttpsError('failed-precondition', action.notAllowedMessage);
      }

      const technicianSnap = await readTechnician(tx, uid);

      tx.update(ref, {
        status: action.nextStatus,
        ...(action.timestampField ? { [action.timestampField]: new Date().toISOString() } : {}),
        ...statusStamp(uid, 'technician'),
        history: FieldValue.arrayUnion(historyEntry(action.history, uid)),
      });
      if (action.stats) writeStats(tx, technicianSnap, action.stats);

      return { job: current, technician: technicianSnap };
    });

    await pushToAdmins(notify.technicianJobAction(action.notifyAdmins, technicianName(technician), jobId, job));

    return jobResult(ref);
  });
}

/** Technician accepts an assigned (or reassigned) job — the only status change they can make besides declining. */
export const acceptJob = technicianJobAction({
  allowedFrom: isAwaitingResponse,
  notAllowedMessage: 'This job is no longer awaiting a response.',
  nextStatus: 'accepted',
  history: 'accept',
  timestampField: 'acceptedAt',
  notifyAdmins: 'accepted',
});

/** Technician declines — hands the job back to the admin to reassign. Not the same as a cancellation. */
export const declineJob = technicianJobAction({
  allowedFrom: isAwaitingResponse,
  notAllowedMessage: 'This job is no longer awaiting a response.',
  nextStatus: 'declined',
  history: 'decline',
  stats: { pending: -1 },
  notifyAdmins: 'declined',
});

/** Technician marks an accepted job done. */
export const completeJob = technicianJobAction({
  allowedFrom: (status) => status === 'accepted',
  notAllowedMessage: 'Only an accepted job can be marked complete.',
  nextStatus: 'completed',
  history: 'complete',
  timestampField: 'completedAt',
  stats: { pending: -1, completed: 1 },
  notifyAdmins: 'completed',
});

/** Admin-only. Reason is optional — cancelling doesn't require an explanation. Any job that isn't already finished can be cancelled. */
export const cancelJob = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const jobId = requireString(request.data, 'jobId');
  const cancelReason = optionalTrimmed(request.data?.reason);
  const ref = jobRef(jobId);

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
    await pushToTechnician(job.technicianId, notify.jobCancelled(jobId, job));
  }

  return jobResult(ref);
});
