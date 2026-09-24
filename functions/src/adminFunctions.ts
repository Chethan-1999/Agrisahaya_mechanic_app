import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { requireAdmin } from './lib/authz';
import { db } from './lib/firebaseAdmin';
import { onCall } from './lib/onCall';

function requireFcmToken(data: unknown): string {
  const fcmToken = (data as { fcmToken?: unknown } | undefined)?.fcmToken;

  if (typeof fcmToken !== 'string' || !fcmToken) {
    throw new HttpsError('invalid-argument', 'fcmToken is required.');
  }

  return fcmToken;
}

/**
 * The admin app registers its push token on every sign-in/app open. Unlike a technician's single `fcmToken`, admins
 * keep a list — no single-device rule applies to them, so every signed-in device gets the admin pushes (lib/push.ts).
 */
export const registerAdminDevice = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const fcmToken = requireFcmToken(request.data);

  await db.collection('admins').doc(uid).update({ fcmTokens: FieldValue.arrayUnion(fcmToken) });

  return { status: 'ok' };
});

/** Called on logout, before signing out, so a device nobody is signed in on stops getting admin pushes. */
export const unregisterAdminDevice = onCall(async (request) => {
  const uid = await requireAdmin(request);
  const fcmToken = requireFcmToken(request.data);

  await db.collection('admins').doc(uid).update({ fcmTokens: FieldValue.arrayRemove(fcmToken) });

  return { status: 'ok' };
});
