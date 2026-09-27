import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { db } from './firebaseAdmin';
import type { JobStatus } from './jobStatus';
import { technicianRef } from './technicians';

export type JobDoc = {
  technicianId: string | null;
  status: JobStatus;
  jobCode?: string;
  description: string;
  deleted?: boolean;
  /** Set when the job was taken back from a deactivated technician; cleared as soon as it is assigned again. */
  needsReassignment?: boolean;
};

export type JobFields = {
  farmerName: string;
  farmerPhone: string;
  equipment: string;
  issue: string;
  district: string;
  additionalNotes: string;
};

export const jobRef = (id: string) => db.collection('jobs').doc(id);

/** Reads a job inside a transaction. A soft-deleted job is treated as gone. */
export async function readJob(tx: Transaction, ref: DocumentReference): Promise<JobDoc> {
  const snap = await tx.get(ref);
  const data = snap.data() as JobDoc | undefined;

  if (!snap.exists || !data || data.deleted) {
    throw new HttpsError('not-found', 'Job not found.');
  }

  return data;
}

/** Loads the caller's own job inside a transaction, or throws if it isn't theirs. */
export async function readOwnJob(tx: Transaction, uid: string, ref: DocumentReference): Promise<JobDoc> {
  const job = await readJob(tx, ref);

  if (job.technicianId !== uid) {
    throw new HttpsError('permission-denied', 'This is not your job.');
  }

  return job;
}

/** Reads a technician inside a transaction; every read in a transaction has to happen before its first write. */
export const readTechnician = (tx: Transaction, id: string) => tx.get(technicianRef(id));

/**
 * A job mutation's response: the job as it now stands, so the client can show the change straight away instead of
 * waiting to reload every job (it still refreshes the full list in the background).
 */
export async function jobResult(ref: DocumentReference) {
  const snap = await ref.get();
  return { status: 'ok' as const, job: { id: ref.id, ...snap.data() } };
}

const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Validates the six admin-entered job fields; the client form checks the same rules, but never trust the client alone. */
export function parseJobFields(data: Record<string, unknown> | undefined): JobFields {
  const fields: JobFields = {
    farmerName: trimmed(data?.farmerName),
    farmerPhone: trimmed(data?.farmerPhone),
    equipment: trimmed(data?.equipment),
    issue: trimmed(data?.issue),
    district: trimmed(data?.district),
    additionalNotes: trimmed(data?.additionalNotes),
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
export const describeJob = ({ equipment, issue }: Pick<JobFields, 'equipment' | 'issue'>) => `${equipment} — ${issue}`;

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Human-readable id like "#26091901" (YYMMDD + per-day sequence), allocated in a transaction so concurrent creates never collide.
 * The day is the India day: Cloud Functions run in UTC, so using the server's own clock would date a job created
 * before 05:30 IST with the previous day.
 */
export async function nextJobCode(now: Date): Promise<string> {
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
