import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '../firebase';
import type { Mechanic, MechanicForm } from '../types';

const collectionName = 'mechanics';

const toMechanic = (id: string, data: Record<string, unknown>): Mechanic => ({
  id,
  fullName: String(data.fullName ?? ''),
  phoneNumber: String(data.phoneNumber ?? ''),
  village: String(data.village ?? ''),
  district: String(data.district ?? ''),
  state: String(data.state ?? ''),
  pincode: String(data.pincode ?? ''),
  address: String(data.address ?? ''),
  age: String(data.age ?? ''),
  experience: String(data.experience ?? ''),
  isActive: Boolean(data.isActive ?? true),
  createdAt: String(data.createdAt ?? ''),
  updatedAt: String(data.updatedAt ?? ''),
});

export async function createMechanic(form: MechanicForm) {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, collectionName), {
    ...form,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  return ref.id;
}

export async function getMechanic(id: string) {
  const snapshot = await getDoc(doc(db, collectionName, id));

  if (!snapshot.exists()) {
    return null;
  }

  return toMechanic(snapshot.id, snapshot.data());
}

export async function findMechanicByPhone(phoneNumber: string) {
  const mechanicsQuery = query(collection(db, collectionName), where('phoneNumber', '==', phoneNumber));
  const snapshot = await getDocs(mechanicsQuery);
  const first = snapshot.docs[0];

  return first ? toMechanic(first.id, first.data()) : null;
}

export async function listMechanics() {
  const mechanicsQuery = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(mechanicsQuery);

  return snapshot.docs.map((mechanicDoc) => toMechanic(mechanicDoc.id, mechanicDoc.data()));
}

export async function updateMechanic(id: string, form: Partial<MechanicForm> & { isActive?: boolean }) {
  await updateDoc(doc(db, collectionName, id), {
    ...form,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteMechanic(id: string) {
  await deleteDoc(doc(db, collectionName, id));
}