import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '../firebase';
import type { Job, JobForm } from '../types';

const collectionName = 'jobs';

export function getNextJobId(jobs: Job[]) {
  const prefix = getJobIdDatePrefix(new Date());
  const highestJobSequence = jobs.reduce((highest, job) => {
    if (!job.jobId.startsWith(prefix)) {
      return highest;
    }

    const numericId = Number(job.jobId.slice(prefix.length));

    return Number.isFinite(numericId) ? Math.max(highest, numericId) : highest;
  }, 0);

  return `${prefix}${String(highestJobSequence + 1).padStart(2, '0')}`;
}

function getJobIdDatePrefix(date: Date) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `#${year}${month}${day}`;
}

const toJob = (id: string, data: Record<string, unknown>): Job => ({
  id,
  jobId: String(data.jobId ?? ''),
  assignedMechanicId: String(data.assignedMechanicId ?? ''),
  assignedMechanicName: String(data.assignedMechanicName ?? ''),
  assignedAt: String(data.assignedAt ?? ''),
  customerName: String(data.customerName ?? ''),
  phoneNumber: String(data.phoneNumber ?? ''),
  equipment: String(data.equipment ?? ''),
  issue: String(data.issue ?? ''),
  district: String(data.district ?? ''),
  additionalNotes: String(data.additionalNotes ?? data.comments ?? ''),
  createdAt: String(data.createdAt ?? ''),
  updatedAt: String(data.updatedAt ?? ''),
});

export async function createJob(form: JobForm, jobId: string) {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, collectionName), {
    ...form,
    jobId,
    createdAt: now,
    updatedAt: now,
  });

  return ref.id;
}

export async function listJobs() {
  const jobsQuery = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(jobsQuery);

  return snapshot.docs.map((jobDoc) => toJob(jobDoc.id, jobDoc.data()));
}

export async function listAssignedJobs(mechanicId: string) {
  const jobsQuery = query(collection(db, collectionName), where('assignedMechanicId', '==', mechanicId));
  const snapshot = await getDocs(jobsQuery);

  return snapshot.docs
    .map((jobDoc) => toJob(jobDoc.id, jobDoc.data()))
    .sort((firstJob, secondJob) => secondJob.createdAt.localeCompare(firstJob.createdAt));
}

export async function updateJob(id: string, form: JobForm) {
  await updateDoc(doc(db, collectionName, id), {
    ...form,
    updatedAt: new Date().toISOString(),
  });
}

export async function assignJob(id: string, mechanicId: string, mechanicName: string) {
  await updateDoc(doc(db, collectionName, id), {
    assignedMechanicId: mechanicId,
    assignedMechanicName: mechanicName,
    assignedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteJob(id: string) {
  await deleteDoc(doc(db, collectionName, id));
}