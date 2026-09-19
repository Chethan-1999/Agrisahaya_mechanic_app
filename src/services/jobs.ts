import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../firebase';
import type { Job, JobHistoryEntry, JobStatus } from '../types';

const collectionName = 'jobs';

const toJob = (id: string, data: Record<string, unknown>): Job => ({
  id,
  technicianId: (data.technicianId as string | null) ?? null,
  farmerName: String(data.farmerName ?? ''),
  farmerPhone: String(data.farmerPhone ?? ''),
  description: String(data.description ?? ''),
  status: (data.status as JobStatus) ?? 'open',
  createdAt: String(data.createdAt ?? ''),
  createdBy: String(data.createdBy ?? ''),
  cancelledBy: (data.cancelledBy as string | null) ?? null,
  cancelReason: (data.cancelReason as string | null) ?? null,
  acceptedAt: (data.acceptedAt as string | null) ?? null,
  completedAt: (data.completedAt as string | null) ?? null,
  history: (data.history as JobHistoryEntry[] | undefined) ?? [],
});

/** A technician's own jobs, oldest first — list order doubles as the "Task N" ordinal. */
export async function listOwnJobs(technicianId: string) {
  const q = query(collection(db, collectionName), where('technicianId', '==', technicianId), orderBy('createdAt', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toJob(d.id, d.data()));
}

/** Admin's full job board — every job regardless of status. */
export async function listAllJobs() {
  const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toJob(d.id, d.data()));
}

const createJobFn = httpsCallable<
  { technicianId?: string; farmerName?: string; farmerPhone?: string; description: string },
  { status: string; jobId: string }
>(functions, 'createJob');

const assignJobFn = httpsCallable<{ jobId: string; technicianId: string }, { status: string }>(functions, 'assignJob');
const acceptJobFn = httpsCallable<{ jobId: string }, { status: string }>(functions, 'acceptJob');
const declineJobFn = httpsCallable<{ jobId: string }, { status: string }>(functions, 'declineJob');
const completeJobFn = httpsCallable<{ jobId: string }, { status: string }>(functions, 'completeJob');
const cancelJobFn = httpsCallable<{ jobId: string; reason?: string }, { status: string }>(functions, 'cancelJob');

export async function createJob(input: { technicianId?: string; farmerName?: string; farmerPhone?: string; description: string }) {
  const result = await createJobFn(input);
  return result.data.jobId;
}

export async function assignJob(jobId: string, technicianId: string) {
  await assignJobFn({ jobId, technicianId });
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
