import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../firebase';
import type { Job, JobFields, JobHistoryEntry, JobStatus } from '../types';

const collectionName = 'jobs';

const toJob = (id: string, data: Record<string, unknown>): Job => ({
  id,
  jobCode: String(data.jobCode ?? ''),
  technicianId: (data.technicianId as string | null) ?? null,
  farmerName: String(data.farmerName ?? ''),
  farmerPhone: String(data.farmerPhone ?? ''),
  // Jobs logged before equipment/issue/district existed only carry `description`.
  equipment: String(data.equipment ?? ''),
  issue: String(data.issue ?? ''),
  district: String(data.district ?? ''),
  additionalNotes: String(data.additionalNotes ?? ''),
  description: String(data.description ?? ''),
  status: (data.status as JobStatus) ?? 'open',
  createdAt: String(data.createdAt ?? ''),
  createdBy: String(data.createdBy ?? ''),
  cancelledBy: (data.cancelledBy as string | null) ?? null,
  cancelReason: (data.cancelReason as string | null) ?? null,
  acceptedAt: (data.acceptedAt as string | null) ?? null,
  completedAt: (data.completedAt as string | null) ?? null,
  statusUpdatedBy: String(data.statusUpdatedBy ?? ''),
  statusUpdatedByRole: data.statusUpdatedByRole === 'admin' || data.statusUpdatedByRole === 'technician' ? data.statusUpdatedByRole : '',
  statusUpdatedAt: String(data.statusUpdatedAt ?? ''),
  deleted: data.deleted === true,
  history: (data.history as JobHistoryEntry[] | undefined) ?? [],
});

/** A technician's own jobs, oldest first — list order doubles as the "Task N" ordinal. */
export async function listOwnJobs(technicianId: string) {
  const q = query(collection(db, collectionName), where('technicianId', '==', technicianId), orderBy('createdAt', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toJob(d.id, d.data())).filter((job) => !job.deleted);
}

/**
 * Admin's full job board — every job regardless of status, deleted ones included so the deleted count stays available.
 * Screens show `visibleJobs(jobs)`; the dashboard/summary counts read `jobs.filter(job => job.deleted)`.
 */
export async function listAllJobs() {
  const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toJob(d.id, d.data()));
}

const createJobFn = httpsCallable<JobFields & { technicianId?: string }, { status: string; jobId: string; jobCode: string }>(functions, 'createJob');
const updateJobFn = httpsCallable<JobFields & { jobId: string }, { status: string }>(functions, 'updateJob');
const deleteJobFn = httpsCallable<{ jobId: string }, { status: string }>(functions, 'deleteJob');
const assignJobFn = httpsCallable<{ jobId: string; technicianId: string; markCompleted?: boolean }, { status: string }>(functions, 'assignJob');
const acceptJobFn = httpsCallable<{ jobId: string }, { status: string }>(functions, 'acceptJob');
const declineJobFn = httpsCallable<{ jobId: string }, { status: string }>(functions, 'declineJob');
const completeJobFn = httpsCallable<{ jobId: string }, { status: string }>(functions, 'completeJob');
const completeJobAsAdminFn = httpsCallable<{ jobId: string }, { status: string }>(functions, 'completeJobAsAdmin');
const cancelJobFn = httpsCallable<{ jobId: string; reason?: string }, { status: string }>(functions, 'cancelJob');

export async function createJob(input: JobFields & { technicianId?: string }) {
  const result = await createJobFn(input);
  return result.data.jobCode;
}

export async function updateJob(jobId: string, fields: JobFields) {
  await updateJobFn({ jobId, ...fields });
}

export async function deleteJob(jobId: string) {
  await deleteJobFn({ jobId });
}

export async function completeJobAsAdmin(jobId: string) {
  await completeJobAsAdminFn({ jobId });
}

/** `markCompleted` assigns and closes the job in one step (work already done by phone), so it can't be left half-applied. */
export async function assignJob(jobId: string, technicianId: string, markCompleted = false) {
  await assignJobFn({ jobId, technicianId, markCompleted });
}

export async function acceptJob(jobId: string) {
  await acceptJobFn({ jobId });
}

export async function declineJob(jobId: string) {
  await declineJobFn({ jobId });
}

export async function completeJob(jobId: string) {
  await completeJobFn({ jobId });
}

export async function cancelJob(jobId: string, reason?: string) {
  await cancelJobFn({ jobId, reason });
}

/** Jobs the admin should still see on the boards (soft-deleted ones are hidden). */
export const visibleJobs = (jobs: Job[]) => jobs.filter((job) => !job.deleted);

/** Awaiting the admin's attention first (unassigned or declined), then jobs out with a technician, then completed, then cancelled. */
const statusRank: Record<JobStatus, number> = {
  open: 0,
  declined: 0,
  assigned: 1,
  reassigned: 1,
  accepted: 1,
  completed: 2,
  cancelled: 3,
};

/** Admin board order: pending work floats to the top as a standing reminder, completed jobs follow, newest first within each group. */
export function sortForAdmin(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => statusRank[a.status] - statusRank[b.status] || b.createdAt.localeCompare(a.createdAt));
}
