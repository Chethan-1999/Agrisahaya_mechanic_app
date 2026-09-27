import type { DocumentSnapshot, Transaction } from 'firebase-admin/firestore';

/** A technician's job counters (`technicians/{id}.jobStats`). `deleted` stays for older records from before job deletion was removed. */
export type JobStats = Record<'pending' | 'completed' | 'cancelled' | 'deleted', number>;
export type JobStatsDelta = Partial<JobStats>;

export const EMPTY_JOB_STATS: JobStats = { pending: 0, completed: 0, cancelled: 0, deleted: 0 };

/** `stats` with `delta` added to it, never going below zero. */
export function applyStatsDelta(stats: Partial<JobStats> | undefined, delta: JobStatsDelta): JobStats {
  const next = { ...EMPTY_JOB_STATS, ...stats };

  for (const [key, value] of Object.entries(delta) as Array<[keyof JobStats, number | undefined]>) {
    next[key] = Math.max(0, next[key] + (value ?? 0));
  }

  return next;
}

/** Applies counter deltas to a technician's `jobStats` inside a transaction. A missing technician is skipped. */
export function writeStats(tx: Transaction, technician: DocumentSnapshot, delta: JobStatsDelta): void {
  if (!technician.exists) return;

  tx.update(technician.ref, { jobStats: applyStatsDelta(technician.data()?.jobStats, delta) });
}
