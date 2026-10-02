import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../firebase';
import type { Mechanic, MechanicForm, MechanicStatus, ProfileEdit } from '../types';

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
    machineExpertise: String(data.machineExpertise ?? data.age ?? ''),
    experience: String(data.experience ?? ''),
    status: (data.status as MechanicStatus) ?? 'pending',
    paymentVerified: Boolean(data.paymentVerified ?? false),
    rejectionReason: typeof data.rejectionReason === 'string' && data.rejectionReason ? data.rejectionReason : null,
    jobStats: {
      pending: Number(jobStats.pending ?? 0),
      completed: Number(jobStats.completed ?? 0),
      cancelled: Number(jobStats.cancelled ?? 0),
      deleted: Number(jobStats.deleted ?? 0),
    },
    walletPoints: Number(data.walletPoints ?? 0),
    profileVersion: Number(data.profileVersion ?? 1),
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

/** Every version of a technician's profile, newest first. */
export async function listProfileEdits(technicianId: string): Promise<ProfileEdit[]> {
  const editsQuery = query(collection(db, 'profileEdits'), where('technicianId', '==', technicianId), orderBy('version', 'desc'));
  const snapshot = await getDocs(editsQuery);

  return snapshot.docs.map((editDoc) => ({ id: editDoc.id, ...editDoc.data() }) as ProfileEdit);
}

/** Profile fields only — the functions refuse phoneNumber, status, paymentVerified and anything else by name. */
type ProfileUpdate = Partial<Omit<MechanicForm, 'phoneNumber'>>;
type ProfileEditResult = { status: 'ok' | 'unchanged'; profileVersion: number };

const adminUpdateProfileFn = httpsCallable<
  { technicianId: string; profile: ProfileUpdate },
  ProfileEditResult
>(functions, 'adminUpdateProfile');

export async function adminUpdateProfile(technicianId: string, profile: ProfileUpdate) {
  return (await adminUpdateProfileFn({ technicianId, profile })).data;
}

const updateOwnProfileFn = httpsCallable<{ profile: ProfileUpdate }, ProfileEditResult>(functions, 'updateOwnProfile');

export async function updateOwnProfile(profile: ProfileUpdate) {
  return (await updateOwnProfileFn({ profile })).data;
}

const reviewSignupFn = httpsCallable<
  { technicianId: string; decision: 'approve' | 'reject'; paymentVerified?: boolean; reason?: string },
  { status: 'ok' }
>(functions, 'reviewSignup');

const setTechnicianStatusFn = httpsCallable<
  { technicianId: string; status: 'active' | 'inactive' },
  { status: 'ok' }
>(functions, 'setTechnicianStatus');

export async function reviewSignup(technicianId: string, decision: 'approve' | 'reject', paymentVerified?: boolean, reason?: string) {
  await reviewSignupFn({ technicianId, decision, paymentVerified, reason });
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
