import type { DocumentData, Transaction } from 'firebase-admin/firestore';

import { db } from './firebaseAdmin';

/**
 * Profile versioning. A technician record carries `profileVersion`; every change to its profile fields writes one
 * `profileEdits/{technicianId}_v{version}` document holding the field-level diff, in the same transaction as the
 * technician update — so the record and its history can't disagree. Version 1 is the signup itself.
 *
 * Records created before versioning have no `profileVersion` and no v1 entry; they count as version 1, so their first
 * edit is v2 and its `from` values capture what the record held until then.
 */

/** What caused the edit. */
export type ProfileEditSource = 'signup' | 'reapply' | 'technician' | 'admin';

export type ProfileChanges = Record<string, { from: unknown; to: string | null }>;

export const currentProfileVersion = (technician: DocumentData) => Number(technician.profileVersion ?? 1);

const profileEditRef = (technicianId: string, version: number) =>
  db.collection('profileEdits').doc(`${technicianId}_v${version}`);

/**
 * Queues the history entry for writing `updates` over `before` (undefined for a brand-new record) and returns the new
 * version — or null when nothing actually changed, in which case no version is created. Call after the transaction's
 * reads, and write `profileVersion: version` onto the technician in the same transaction.
 */
export function recordProfileEdit(
  tx: Transaction,
  technicianId: string,
  before: DocumentData | undefined,
  updates: Record<string, string | null>,
  source: ProfileEditSource,
  editedBy: string,
  editedAt: string,
): number | null {
  const changes: ProfileChanges = {};

  for (const [field, to] of Object.entries(updates)) {
    const from = before?.[field] ?? null;
    // An empty optional field is stored as '' by edits and null by signup — the same value either way.
    if ((from ?? '') !== (to ?? '')) changes[field] = { from, to };
  }

  if (Object.keys(changes).length === 0) return null;

  const version = before ? currentProfileVersion(before) + 1 : 1;

  // create(), not set(): two racing edits can't both claim the same version.
  tx.create(profileEditRef(technicianId, version), { technicianId, version, source, editedBy, editedAt, changes });

  return version;
}
