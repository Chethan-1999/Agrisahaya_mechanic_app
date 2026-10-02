import { FieldValue, type DocumentData, type DocumentReference } from 'firebase-admin/firestore';
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
import { SMS_SECRETS, sendSms, type SmsResult } from './lib/sms';
import { assertActiveTechnician, technicianName, technicianRef } from './lib/technicians';

/**
 * Farmer subscriptions: a mechanic refers a farmer by filling in the subscription form (`submitFarmerSubscription`),
 * an admin checks the request is genuine and approves or rejects it (`reviewFarmerSubscription`). Approving starts the
 * farmer's plan and sends them a confirmation SMS. Status: `pending → approved | rejected`, one step, never back.
 * Payment is collected outside the app, after verification — nothing here records it.
 *
 * The confirmation SMS is tracked on the request — `smsStatus` (`sent` | `queued` | `failed` | `not-configured`),
 * `smsError`, `smsVia` (`gateway` | `admin-phone`), and who did it and when (`smsBy`, `smsByName`, `smsAt`) — written
 * only by these admin callables (firestore.rules denies every client write). Until it is `sent`, the admin app
 * highlights the card and offers to send the text from the admin's own phone.
 */

const farmerSubscriptionRef = (id: string) => db.collection('farmerSubscriptions').doc(id);

/** The request as it now stands, so the client can show the change at once (same shape as the job callables). */
async function subscriptionResult(ref: DocumentReference) {
  const snap = await ref.get();
  return { status: 'ok' as const, request: { id: ref.id, ...snap.data() } };
}

/** Records an SMS attempt (or an admin's own send) on the request: how it went, how it was sent, and by which admin. */
async function recordSms(ref: DocumentReference, adminUid: string, via: 'gateway' | 'admin-phone', result: SmsResult) {
  const admin = await db.collection('admins').doc(adminUid).get();
  const now = new Date().toISOString();

  await ref.update({
    smsStatus: result.status,
    smsError: result.error ?? null,
    smsVia: via,
    smsBy: adminUid,
    smsByName: String(admin.data()?.name ?? ''),
    smsAt: now,
    updatedAt: now,
  });
}

/** Sends the confirmation through the SMS provider, records it, and tells every admin when it didn't go out. */
async function sendConfirmationSms(ref: DocumentReference, adminUid: string, farmer: { fullName: string; phoneNumber: string }, message: string) {
  const result = await sendSms(farmer.phoneNumber, message);
  await recordSms(ref, adminUid, 'gateway', result);

  if (result.status !== 'sent') {
    await pushToAdmins(notify.farmerSmsNotSent(ref.id, farmer, result.error ?? 'SMS not sent.'));
  }
}

const farmerContact = (data: DocumentData) => ({ fullName: String(data.fullName ?? ''), phoneNumber: String(data.phoneNumber ?? '') });

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
      smsError: null,
      smsVia: null,
      smsBy: null,
      smsByName: null,
      smsAt: null,
    });

    return technicianName(technician);
  });

  await pushToAdmins(notify.newFarmerRequest(ref.id, farmer, referrer));

  return subscriptionResult(ref);
});

/**
 * Admin confirms a request is genuine ("Approve Subscription") or rejects it. Approving starts the plan today (India
 * time) for `subscriptionPlanMonths`, stores the confirmation SMS text, and sends it through lib/sms.ts. Approving also
 * credits the referring mechanic `farmerReferralPoints` wallet points — an atomic increment of
 * `technicians/{id}.walletPoints`, in the same transaction, so it happens exactly once per request.
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

    // Read before any write (a transaction rule); a referrer whose record is gone simply earns nothing.
    const referrer = approved ? await tx.get(technicianRef(String(data.technicianId))) : null;

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
      walletPointsAwarded: referrer?.exists ? settings.farmerReferralPoints : 0,
    });

    if (referrer?.exists && settings.farmerReferralPoints > 0) {
      tx.update(referrer.ref, { walletPoints: FieldValue.increment(settings.farmerReferralPoints) });
    }

    return { data, smsMessage };
  });

  if (reviewed.smsMessage) {
    await sendConfirmationSms(ref, adminUid, farmerContact(reviewed.data), reviewed.smsMessage);
  }

  await pushToTechnician(
    String(reviewed.data.technicianId),
    notify.farmerRequestReviewed(requestId, String(reviewed.data.fullName), approved),
  );

  return subscriptionResult(ref);
}, { secrets: SMS_SECRETS });

/**
 * Admin re-sends an approved farmer's confirmation SMS through the provider — e.g. after a failure or a gateway phone
 * that was offline. The text is rebuilt from the current template (lib/farmerMessages.ts) and the plan's stored dates,
 * so a request approved before a wording change goes out with the new wording.
 */
export const resendFarmerSubscriptionSms = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const requestId = requireString(request.data, 'requestId');
  const ref = farmerSubscriptionRef(requestId);
  const data = (await requireDoc(ref, 'Subscription request not found.')).data() ?? {};

  if (data.status !== 'approved' || !data.planStartDate || !data.planEndDate) {
    throw new HttpsError('failed-precondition', 'Only an approved subscription has a confirmation SMS to send.');
  }

  const { supportPhoneNumber } = await getSettings();
  const smsMessage = subscriptionConfirmed({
    farmerName: String(data.fullName),
    startDate: String(data.planStartDate),
    endDate: String(data.planEndDate),
    supportPhoneNumber,
  });

  await ref.update({ smsMessage });
  await sendConfirmationSms(ref, adminUid, farmerContact(data), smsMessage);

  return subscriptionResult(ref);
}, { secrets: SMS_SECRETS });

/**
 * Admin confirms they sent the confirmation SMS from their own phone (the app's "Send SMS" opens their Messages app
 * with the stored text) — recorded as sent, by them, via `admin-phone`.
 */
export const recordFarmerSmsSentFromPhone = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const requestId = requireString(request.data, 'requestId');
  const ref = farmerSubscriptionRef(requestId);
  const data = (await requireDoc(ref, 'Subscription request not found.')).data() ?? {};

  if (data.status !== 'approved' || !data.smsMessage) {
    throw new HttpsError('failed-precondition', 'Only an approved subscription has a confirmation SMS to send.');
  }

  await recordSms(ref, adminUid, 'admin-phone', { status: 'sent' });

  return subscriptionResult(ref);
});
