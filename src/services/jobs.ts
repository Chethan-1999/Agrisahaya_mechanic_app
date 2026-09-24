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
  needsReassignment: data.needsReassignment === true,
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

/** Every job mutation answers with the job as it now stands (see `jobResult` in functions/src/jobFunctions.ts). */
type JobResult = { status: string; job: { id: string } & Record<string, unknown> };
const resultJob = ({ data }: { data: JobResult }) => toJob(data.job.id, data.job);

const createJobFn = httpsCallable<JobFields & { technicianId?: string }, JobResult & { jobId: string; jobCode: string }>(functions, 'createJob');
const updateJobFn = httpsCallable<JobFields & { jobId: string }, JobResult>(functions, 'updateJob');
const assignJobFn = httpsCallable<{ jobId: string; technicianId: string; markCompleted?: boolean }, JobResult>(functions, 'assignJob');
const acceptJobFn = httpsCallable<{ jobId: string }, JobResult>(functions, 'acceptJob');
const declineJobFn = httpsCallable<{ jobId: string }, JobResult>(functions, 'declineJob');
const completeJobFn = httpsCallable<{ jobId: string }, JobResult>(functions, 'completeJob');
const completeJobAsAdminFn = httpsCallable<{ jobId: string }, JobResult>(functions, 'completeJobAsAdmin');
const cancelJobFn = httpsCallable<{ jobId: string; reason?: string }, JobResult>(functions, 'cancelJob');

export async function createJob(input: JobFields & { technicianId?: string }) {
  return resultJob(await createJobFn(input));
}

export async function updateJob(jobId: string, fields: JobFields) {
  return resultJob(await updateJobFn({ jobId, ...fields }));
}

export async function completeJobAsAdmin(jobId: string) {
  return resultJob(await completeJobAsAdminFn({ jobId }));
}

/** `markCompleted` assigns and closes the job in one step (work already done by phone), so it can't be left half-applied. */
export async function assignJob(jobId: string, technicianId: string, markCompleted = false) {
  return resultJob(await assignJobFn({ jobId, technicianId, markCompleted }));
}

export async function acceptJob(jobId: string) {
  return resultJob(await acceptJobFn({ jobId }));
}

export async function declineJob(jobId: string) {
  return resultJob(await declineJobFn({ jobId }));
}

export async function completeJob(jobId: string) {
  return resultJob(await completeJobFn({ jobId }));
}

export async function cancelJob(jobId: string, reason?: string) {
  return resultJob(await cancelJobFn({ jobId, reason }));
}

/** `jobs` with `job` swapped in for its old copy (or added on top if it's new) — shows a saved change right away. */
export function withJob(jobs: Job[], job: Job): Job[] {
  return jobs.some((current) => current.id === job.id) ? jobs.map((current) => (current.id === job.id ? job : current)) : [job, ...jobs];
}

/** Jobs the admin should still see on the boards (soft-deleted ones are hidden). */
export const visibleJobs = (jobs: Job[]) => jobs.filter((job) => !job.deleted);

/** Awaiting the admin's attention first (unassigned or declined), then everything else, cancelled last. */
const statusRank: Record<JobStatus, number> = {
  open: 0,
  declined: 0,
  assigned: 1,
  reassigned: 1,
  accepted: 1,
  completed: 1,
  cancelled: 2,
};

/** When the job last moved status (older jobs without the stamp fall back to when they were created). */
export const lastChangedAt = (job: Job) => job.statusUpdatedAt || job.createdAt;

/**
 * Admin board order: jobs waiting for a mechanic come first, oldest first so nobody is left waiting longest; below
 * them, the most recently changed job is on top, so a job that was just assigned, accepted or completed doesn't sink.
 */
export function sortForAdmin(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const byRank = statusRank[a.status] - statusRank[b.status];
    if (byRank) return byRank;
    return statusRank[a.status] === 0 ? a.createdAt.localeCompare(b.createdAt) : lastChangedAt(b).localeCompare(lastChangedAt(a));
  });
}
