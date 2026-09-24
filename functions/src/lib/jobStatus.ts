/**
 * Job lifecycle (stored in `jobs/{id}.status`):
 *
 *   open ──assign──▶ assigned ──accept──▶ accepted ──complete──▶ completed (terminal)
 *                       │  ▲                 │
 *                       │  └── reassign ─────┤        any non-terminal ──cancel──▶ cancelled (terminal)
 *                    decline                 │
 *                       ▼                    ▼
 *                   declined ──assign──▶ reassigned ──accept──▶ accepted …
 *
 * `reassigned` behaves exactly like `assigned` (awaiting the technician's answer); it only records that
 * the job has changed hands at least once.
 */
export type JobStatus = 'open' | 'assigned' | 'reassigned' | 'accepted' | 'declined' | 'completed' | 'cancelled';

/** The technician has been given the job but hasn't answered yet. */
export const isAwaitingResponse = (status: string) => status === 'assigned' || status === 'reassigned';

/** A technician currently owns the job and it counts towards their `pending` stat. */
export const isHeld = (status: string) => isAwaitingResponse(status) || status === 'accepted';

export const isFinished = (status: string) => status === 'completed' || status === 'cancelled';

/** Who moved the job into its current state — written on every transition next to `history`. */
export function statusStamp(by: string, role: 'admin' | 'technician') {
  return { statusUpdatedBy: by, statusUpdatedByRole: role, statusUpdatedAt: new Date().toISOString() };
}
