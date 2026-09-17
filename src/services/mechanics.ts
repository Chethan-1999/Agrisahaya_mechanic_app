import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../firebase';
import type { Mechanic, MechanicForm, MechanicStatus } from '../types';

const collectionName = 'technicians';

const toMechanic = (id: string, data: Record<string, unknown>): Mechanic => {
  const jobStats = (data.jobStats ?? {}) as Record<string, unknown>;

  return {
    id,
    fullName: String(data.fullName ?? ''),
    phoneNumber: String(data.phoneNumber ?? ''),
    village: String(data.village ?? ''),
    district: String(data.district ?? ''),
    state: String(data.state ?? ''),
    pincode: String(data.pincode ?? ''),
    address: String(data.address ?? ''),
    landmark: String(data.landmark ?? ''),
    age: String(data.age ?? ''),
    experience: String(data.experience ?? ''),
    status: (data.status as MechanicStatus) ?? 'pending',
    paymentVerified: Boolean(data.paymentVerified ?? false),
    jobStats: {
      pending: Number(jobStats.pending ?? 0),
      completed: Number(jobStats.completed ?? 0),
      cancelled: Number(jobStats.cancelled ?? 0),
    },
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  };
};

export async function getMechanic(id: string) {
  const snapshot = await getDoc(doc(db, collectionName, id));

  if (!snapshot.exists()) {
    return null;
  }

  return toMechanic(snapshot.id, snapshot.data());
}

export async function listMechanics() {
  const mechanicsQuery = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(mechanicsQuery);

  return snapshot.docs.map((mechanicDoc) => toMechanic(mechanicDoc.id, mechanicDoc.data()));
}

/**
 * Admin-only direct edit of profile fields (name, address, etc — not status).
 * Interim only: firestore.rules already denies this to anyone but the Admin
 * SDK, so this call starts failing the moment the new rules are deployed.
 * TODO(M3): move behind a reviewed Cloud Function once profile-update
 * review exists for admin edits too, not just technician-submitted ones.
 */
export async function adminUpdateProfile(id: string, form: Partial<MechanicForm>) {
  await updateDoc(doc(db, collectionName, id), {
    ...form,
    updatedAt: new Date().toISOString(),
  });
}

const reviewSignupFn = httpsCallable<
  { technicianId: string; decision: 'approve' | 'reject'; paymentVerified?: boolean },
  { status: 'ok' }
>(functions, 'reviewSignup');

const setTechnicianStatusFn = httpsCallable<
  { technicianId: string; status: 'active' | 'inactive' },
  { status: 'ok' }
>(functions, 'setTechnicianStatus');

export async function reviewSignup(technicianId: string, decision: 'approve' | 'reject', paymentVerified?: boolean) {
  await reviewSignupFn({ technicianId, decision, paymentVerified });
}

export async function setTechnicianStatus(technicianId: string, status: 'active' | 'inactive') {
  await setTechnicianStatusFn({ technicianId, status });
}

const updateDeviceInfoFn = httpsCallable<{ fcmToken: string }, { status: 'ok' }>(functions, 'updateDeviceInfo');

export async function updateDeviceInfo(fcmToken: string) {
  await updateDeviceInfoFn({ fcmToken });
}

const revokeOtherSessionsFn = httpsCallable<Record<string, never>, { status: 'ok' }>(functions, 'revokeOtherSessions');

/** Best-effort — swallows its own errors so a transient failure (network blip, a flaky emulator) never strands an otherwise-successful sign-in. */
export async function revokeOtherSessions(): Promise<void> {
  try {
    await revokeOtherSessionsFn({});
  } catch (err) {
    console.warn('revokeOtherSessions failed:', err);
  }
}
