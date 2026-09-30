import type { DocumentReference } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { requireAdmin, requireUid } from './lib/authz';
import { requireDoc } from './lib/docHelpers';
import { PLAN_NAME, subscriptionConfirmed } from './lib/farmerMessages';
import { parseFarmerSubscription } from './lib/farmerValidation';
import { db } from './lib/firebaseAdmin';
import * as notify from './lib/notifications';
import { onCall } from './lib/onCall';
import { pushToAdmins, pushToTechnician } from './lib/push';
import { optionalTrimmed, requireString } from './lib/request';
import { getSettings } from './lib/settings';
import { sendSms } from './lib/sms';
import { assertActiveTechnician, technicianName, technicianRef } from './lib/technicians';

/**
 * Farmer subscriptions: a mechanic refers a farmer by filling in the subscription form (`submitFarmerSubscription`),
 * an admin checks the request is genuine and approves or rejects it (`reviewFarmerSubscription`). Approving starts the
 * farmer's plan and sends them a confirmation SMS. Status: `pending → approved | rejected`, one step, never back.
 * Payment is collected outside the app, after verification — nothing here records it.
 */

const farmerSubscriptionRef = (id: string) => db.collection('farmerSubscriptions').doc(id);

/** The request as it now stands, so the client can show the change at once (same shape as the job callables). */
async function subscriptionResult(ref: DocumentReference) {
  const snap = await ref.get();
  return { status: 'ok' as const, request: { id: ref.id, ...snap.data() } };
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today's date in India as "YYYY-MM-DD" — a plan starts on the admin's calendar day, not UTC's. */
const indiaToday = (now: Date) => new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/**
 * The last day of a plan that starts on `startDate` and runs `months` months: "2026-09-30" + 12 → "2027-09-29".
 * A start day the end month doesn't have (31 Jan + 1 month) is clamped to that month's last day first.
 */
export function planEndDate(startDate: string, months: number): string {
  const [year, month, day] = startDate.split('-').map(Number);
  const lastDayOfTarget = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  const end = new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDayOfTarget)));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

/** An active mechanic submits a farmer's subscription form. The farmer's phone may only have one live request. */
export const submitFarmerSubscription = onCall(async (request) => {
  const uid = requireUid(request);
  const farmer = parseFarmerSubscription(request.data?.farmer);
  const ref = db.collection('farmerSubscriptions').doc();
  const samePhone = db.collection('farmerSubscriptions').where('phoneNumber', '==', farmer.phoneNumber);

  const referrer = await db.runTransaction(async (tx) => {
    const technician = await tx.get(technicianRef(uid));
    assertActiveTechnician(technician, 'Only an active mechanic can refer a farmer.');

    // Filtered here rather than in the query: a phone has at most a handful of requests, and it needs no extra index.
    const existing = (await tx.get(samePhone)).docs.find((doc) => doc.data().status !== 'rejected');
    if (existing) {
      throw new HttpsError(
        'already-exists',
        existing.data().status === 'approved'
          ? 'This farmer already has an active subscription.'
          : 'A subscription request for this farmer is already waiting for review.',
      );
    }

    const now = new Date().toISOString();
    tx.set(ref, {
      ...farmer,
      technicianId: uid,
      technicianName: technicianName(technician),
      technicianPhone: String(technician.data()?.phoneNumber ?? ''),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      planName: null,
      planStartDate: null,
      planEndDate: null,
      smsMessage: null,
      smsStatus: null,
      smsSentAt: null,
      smsError: null,
    });

    return technicianName(technician);
  });

  await pushToAdmins(notify.newFarmerRequest(ref.id, farmer, referrer));

  return subscriptionResult(ref);
});

/** Records an SMS attempt on the request. `sentAt` is kept from an earlier success when this attempt didn't send. */
async function sendConfirmationSms(ref: DocumentReference, phoneNumber: string, message: string) {
  const result = await sendSms(phoneNumber, message);
  const now = new Date().toISOString();

  await ref.update({
    smsStatus: result.status,
    smsError: result.error ?? null,
    ...(result.status === 'sent' ? { smsSentAt: now } : {}),
    updatedAt: now,
  });
}

/**
 * Admin confirms a request is genuine ("Approve Subscription") or rejects it. Approving starts the plan today (India
 * time) for `subscriptionPlanMonths`, stores the confirmation SMS text, and sends it through lib/sms.ts.
 */
export const reviewFarmerSubscription = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const requestId = requireString(request.data, 'requestId', 'requestId and a valid decision are required.');
  const { decision, reason } = request.data;

  if (decision !== 'approve' && decision !== 'reject') {
    throw new HttpsError('invalid-argument', 'requestId and a valid decision are required.');
  }

  const approved = decision === 'approve';
  const ref = farmerSubscriptionRef(requestId);
  const settings = await getSettings();

  const reviewed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Subscription request not found.');

    const data = snap.data() ?? {};
    if (data.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'This subscription request has already been reviewed.');
    }

    const now = new Date();
    const review = { reviewedBy: adminUid, reviewedAt: now.toISOString(), updatedAt: now.toISOString() };

    if (!approved) {
      tx.update(ref, { ...review, status: 'rejected', rejectionReason: optionalTrimmed(reason)?.slice(0, 300) ?? null });
      return { data, smsMessage: null };
    }

    const startDate = indiaToday(now);
    const endDate = planEndDate(startDate, settings.subscriptionPlanMonths);
    const smsMessage = subscriptionConfirmed({
      farmerName: String(data.fullName),
      months: settings.subscriptionPlanMonths,
      startDate,
      endDate,
      supportPhoneNumber: settings.supportPhoneNumber,
    });

    tx.update(ref, {
      ...review,
      status: 'approved',
      rejectionReason: null,
      planName: PLAN_NAME,
      planStartDate: startDate,
      planEndDate: endDate,
      smsMessage,
    });

    return { data, smsMessage };
  });

  if (reviewed.smsMessage) {
    await sendConfirmationSms(ref, String(reviewed.data.phoneNumber), reviewed.smsMessage);
  }

  await pushToTechnician(
    String(reviewed.data.technicianId),
    notify.farmerRequestReviewed(requestId, String(reviewed.data.fullName), approved),
  );

  return subscriptionResult(ref);
});

/** Admin re-sends an approved farmer's confirmation SMS through the provider — e.g. once SMS is live, or after a failure. */
export const resendFarmerSubscriptionSms = onCall(async (request) => {
  await requireAdmin(request);
  const requestId = requireString(request.data, 'requestId');
  const ref = farmerSubscriptionRef(requestId);
  const data = (await requireDoc(ref, 'Subscription request not found.')).data() ?? {};

  if (data.status !== 'approved' || !data.smsMessage) {
    throw new HttpsError('failed-precondition', 'Only an approved subscription has a confirmation SMS to send.');
  }

  await sendConfirmationSms(ref, String(data.phoneNumber), String(data.smsMessage));

  return subscriptionResult(ref);
});
