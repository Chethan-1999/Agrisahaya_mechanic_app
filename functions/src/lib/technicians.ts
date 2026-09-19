import { HttpsError } from 'firebase-functions/v2/https';

import { db } from './firebaseAdmin';

/** Throws unless `technicianId` is an existing, active technician — the one condition a job can be assigned into. */
export async function requireActiveTechnician(technicianId: string): Promise<void> {
  const snap = await db.collection('technicians').doc(technicianId).get();

  if (!snap.exists || snap.data()?.status !== 'active') {
    throw new HttpsError('failed-precondition', 'Only an active technician can be assigned a job.');
  }
}
