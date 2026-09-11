import type { DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

/** Fetches a document or throws a uniform not-found error — the "get or 404" pattern every function here needs. */
export async function requireDoc<T = FirebaseFirestore.DocumentData>(
  ref: DocumentReference<T>,
  notFoundMessage: string,
): Promise<DocumentSnapshot<T>> {
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError('not-found', notFoundMessage);
  }

  return snap;
}
