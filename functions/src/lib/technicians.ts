import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { db } from './firebaseAdmin';

export const technicianRef = (id: string) => db.collection('technicians').doc(id);

/** Throws unless `technician` exists and is active — the one condition a job can be assigned into. */
export function assertActiveTechnician(technician: DocumentSnapshot | null): void {
  if (!technician?.exists || technician.data()?.status !== 'active') {
    throw new HttpsError('failed-precondition', 'Only an active mechanic can be assigned a job.');
  }
}

/** A technician's display name for admin-facing messages. */
export const technicianName = (technician: DocumentSnapshot) => String(technician.data()?.fullName ?? 'A mechanic');
