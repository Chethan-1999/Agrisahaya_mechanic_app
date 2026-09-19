import type { CallableRequest } from 'firebase-functions/v2/https';
import { HttpsError } from 'firebase-functions/v2/https';

import { db } from './firebaseAdmin';

/** Throws unless the caller is a signed-in admin. Returns the admin's uid. */
export async function requireAdmin(request: CallableRequest): Promise<string> {
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const adminDoc = await db.collection('admins').doc(uid).get();

  if (!adminDoc.exists) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }

  return uid;
}
