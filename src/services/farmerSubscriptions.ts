import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../firebase';
import type { FarmerSubscription, FarmerSubscriptionForm, FarmerSubscriptionStatus, SmsStatus } from '../types';

const collectionName = 'farmerSubscriptions';

const nullableString = (value: unknown) => (typeof value === 'string' ? value : null);

const toFarmerSubscription = (id: string, data: Record<string, unknown>): FarmerSubscription => ({
  id,
  fullName: String(data.fullName ?? ''),
  phoneNumber: String(data.phoneNumber ?? ''),
  village: String(data.village ?? ''),
  mandalDistrict: String(data.mandalDistrict ?? ''),
  pincode: String(data.pincode ?? ''),
  state: String(data.state ?? ''),
  machinery: Array.isArray(data.machinery) ? data.machinery.map(String) : [],
  machineryOther: String(data.machineryOther ?? ''),
  technicianId: String(data.technicianId ?? ''),
  technicianName: String(data.technicianName ?? ''),
  technicianPhone: String(data.technicianPhone ?? ''),
  status: (data.status as FarmerSubscriptionStatus) ?? 'pending',
  createdAt: String(data.createdAt ?? ''),
  reviewedAt: nullableString(data.reviewedAt),
  rejectionReason: nullableString(data.rejectionReason),
  planName: nullableString(data.planName),
  planStartDate: nullableString(data.planStartDate),
  planEndDate: nullableString(data.planEndDate),
  smsMessage: nullableString(data.smsMessage),
  smsStatus: nullableString(data.smsStatus) as SmsStatus | null,
  smsError: nullableString(data.smsError),
  smsVia: nullableString(data.smsVia) as FarmerSubscription['smsVia'],
  smsByName: nullableString(data.smsByName),
  smsAt: nullableString(data.smsAt),
});

/** The farmers a mechanic has referred, newest first. */
export async function listOwnFarmerSubscriptions(technicianId: string) {
  const q = query(collection(db, collectionName), where('technicianId', '==', technicianId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toFarmerSubscription(d.id, d.data()));
}

/** Admin: every farmer subscription request, newest first. */
export async function listAllFarmerSubscriptions() {
  const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toFarmerSubscription(d.id, d.data()));
}

/** Every mutation answers with the request as it now stands (see `subscriptionResult` in farmerSubscriptionFunctions.ts). */
type SubscriptionResult = { status: string; request: { id: string } & Record<string, unknown> };
const resultRequest = ({ data }: { data: SubscriptionResult }) => toFarmerSubscription(data.request.id, data.request);

const submitFn = httpsCallable<{ farmer: FarmerSubscriptionForm }, SubscriptionResult>(functions, 'submitFarmerSubscription');
const reviewFn = httpsCallable<{ requestId: string; decision: 'approve' | 'reject'; reason?: string }, SubscriptionResult>(
  functions,
  'reviewFarmerSubscription',
);
const resendSmsFn = httpsCallable<{ requestId: string }, SubscriptionResult>(functions, 'resendFarmerSubscriptionSms');
const recordSmsSentFromPhoneFn = httpsCallable<{ requestId: string }, SubscriptionResult>(functions, 'recordFarmerSmsSentFromPhone');

export async function submitFarmerSubscription(farmer: FarmerSubscriptionForm) {
  return resultRequest(await submitFn({ farmer }));
}

export async function reviewFarmerSubscription(requestId: string, decision: 'approve' | 'reject', reason?: string) {
  return resultRequest(await reviewFn({ requestId, decision, reason }));
}

export async function resendFarmerSubscriptionSms(requestId: string) {
  return resultRequest(await resendSmsFn({ requestId }));
}

/** Admin: records that they sent the confirmation SMS from their own phone. */
export async function recordFarmerSmsSentFromPhone(requestId: string) {
  return resultRequest(await recordSmsSentFromPhoneFn({ requestId }));
}

/** Swaps an updated request into a list, keeping its position. */
export const withFarmerSubscription = (list: FarmerSubscription[], updated: FarmerSubscription) =>
  list.map((item) => (item.id === updated.id ? updated : item));
