import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAdmin } from './lib/authz';
import { requireDoc } from './lib/docHelpers';
import { db } from './lib/firebaseAdmin';
import { pushToTechnician } from './lib/push';

/** Admin approves or rejects a pending technician. This is the activation gate. */
export const reviewSignup = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { technicianId, decision, paymentVerified } = request.data ?? {};

  if (typeof technicianId !== 'string' || (decision !== 'approve' && decision !== 'reject')) {
    throw new HttpsError('invalid-argument', 'technicianId and a valid decision are required.');
  }

  const ref = db.collection('technicians').doc(technicianId);
  const snap = await requireDoc(ref, 'Technician not found.');

  if (snap.data()?.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'This technician has already been reviewed.');
  }

  await ref.update({
    status: decision === 'approve' ? 'active' : 'rejected',
    paymentVerified: typeof paymentVerified === 'boolean' ? paymentVerified : (snap.data()?.paymentVerified ?? false),
    approvedBy: adminUid,
    updatedAt: new Date().toISOString(),
  });

  if (decision === 'approve') {
    await pushToTechnician(technicianId, {
      title: 'Account activated',
      body: 'Your AgriSahaya account is verified — you can now receive jobs.',
      data: { type: 'account-activated' },
    });
  }

  return { status: 'ok' };
});

/** Admin toggles an already-reviewed technician between active and inactive. */
export const setTechnicianStatus = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { technicianId, status } = request.data ?? {};
  const allowed = ['active', 'inactive'];

  if (typeof technicianId !== 'string' || !allowed.includes(status)) {
    throw new HttpsError('invalid-argument', 'technicianId and a valid status ("active" or "inactive") are required.');
  }

  const ref = db.collection('technicians').doc(technicianId);
  const snap = await requireDoc(ref, 'Technician not found.');

  if (!allowed.includes(snap.data()?.status)) {
    throw new HttpsError(
      'failed-precondition',
      'Only an already-approved technician can be toggled this way — use reviewSignup for a pending one.',
    );
  }

  await ref.update({
    status,
    approvedBy: adminUid,
    updatedAt: new Date().toISOString(),
  });

  return { status: 'ok' };
});

/** Self-service: a signed-in technician registers/refreshes their push token. */
export const updateDeviceInfo = onCall(async (request) => {
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const fcmToken = request.data?.fcmToken;

  if (typeof fcmToken !== 'string' || !fcmToken) {
    throw new HttpsError('invalid-argument', 'fcmToken is required.');
  }

  await db.collection('technicians').doc(uid).update({
    fcmToken,
    updatedAt: new Date().toISOString(),
  });

  return { status: 'ok' };
});
