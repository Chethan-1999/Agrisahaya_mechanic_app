export type JobAction = 'create' | 'assign' | 'accept' | 'decline' | 'complete' | 'cancel';

export type JobHistoryEntry = {
  action: JobAction;
  by: string;
  at: string;
  [extra: string]: unknown;
};

/** One entry per job state-changing action — the single mechanism every job function appends to, instead of one-off fields like `declinedBy`. */
export function historyEntry(action: JobAction, by: string, extra: Record<string, unknown> = {}): JobHistoryEntry {
  return { action, by, at: new Date().toISOString(), ...extra };
}
