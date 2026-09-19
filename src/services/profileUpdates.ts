import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../firebase';
import type { MechanicForm, ProfileUpdateRequest, ProfileUpdateStatus } from '../types';

const collectionName = 'profileUpdateRequests';

const toRequest = (id: string, data: Record<string, unknown>): ProfileUpdateRequest => ({
  id,
  technicianId: String(data.technicianId ?? ''),
  changes: (data.changes ?? {}) as Partial<MechanicForm>,
  message: String(data.message ?? ''),
  status: (data.status as ProfileUpdateStatus) ?? 'pending',
  createdAt: String(data.createdAt ?? ''),
  reviewedBy: (data.reviewedBy as string | null) ?? null,
  reviewedAt: (data.reviewedAt as string | null) ?? null,
  adminNote: (data.adminNote as string | null) ?? null,
});

export async function listOwnProfileUpdateRequests(technicianId: string) {
  const q = query(collection(db, collectionName), where('technicianId', '==', technicianId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toRequest(d.id, d.data()));
}

export async function listPendingProfileUpdateRequests() {
  const q = query(collection(db, collectionName), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toRequest(d.id, d.data()));
}

const submitFn = httpsCallable<{ changes: Partial<MechanicForm>; message: string }, { status: string; requestId: string }>(
  functions,
  'submitProfileUpdate',
);

const reviewFn = httpsCallable<{ requestId: string; decision: 'approve' | 'reject'; adminNote?: string }, { status: string }>(
  functions,
  'reviewProfileUpdate',
);

export async function submitProfileUpdate(changes: Partial<MechanicForm>, message: string) {
  await submitFn({ changes, message });
}

export async function reviewProfileUpdate(requestId: string, decision: 'approve' | 'reject', adminNote?: string) {
  await reviewFn({ requestId, decision, adminNote });
}
