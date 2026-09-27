import { FieldValue } from 'firebase-admin/firestore';
import { getMessaging, type TokenMessage } from 'firebase-admin/messaging';

import { app, db } from './firebaseAdmin';

const messaging = getMessaging(app);

/** What a push says and carries — built by lib/notifications.ts, sent by the helpers below. */
export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

const FCM_BATCH_SIZE = 500; // sendEach's per-call cap

// FCM error codes meaning the token will never work again (app uninstalled, data cleared, token rotated).
const DEAD_TOKEN_CODES = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

const toMessage = (token: string, { title, body, data }: PushPayload): TokenMessage => ({
  token,
  notification: { title, body },
  data,
  android: { priority: 'high' },
});

/** Best-effort push to one technician's registered device. Never throws — a missing/stale token just means no push goes out. */
export async function pushToTechnician(technicianId: string, payload: PushPayload): Promise<void> {
  const snap = await db.collection('technicians').doc(technicianId).get();
  const token = snap.data()?.fcmToken as string | undefined;

  if (!token) return;

  try {
    await messaging.send(toMessage(token, payload));
  } catch (err) {
    console.warn(`push failed for technician ${technicianId}:`, err);
  }
}

/** Best-effort broadcast to many tokens at once, chunked to FCM's 500-per-call limit. Never throws — same ethos as pushToTechnician. */
export async function pushBroadcast(tokens: string[], payload: PushPayload): Promise<void> {
  for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
    try {
      await messaging.sendEach(tokens.slice(i, i + FCM_BATCH_SIZE).map((token) => toMessage(token, payload)));
    } catch (err) {
      console.warn('broadcast push batch failed:', err);
    }
  }
}

/**
 * Best-effort push to every admin's registered devices (`admins/{uid}.fcmTokens` — an admin can be signed in on
 * several). Never throws, same ethos as pushToTechnician. Tokens FCM reports as dead are pruned so they don't pile up.
 */
export async function pushToAdmins(payload: PushPayload): Promise<void> {
  try {
    const admins = await db.collection('admins').get();
    const targets = admins.docs.flatMap((doc) =>
      ((doc.data().fcmTokens as string[] | undefined) ?? []).map((token) => ({ ref: doc.ref, token })),
    );

    if (targets.length === 0) return;

    const { responses } = await messaging.sendEach(targets.map(({ token }) => toMessage(token, payload)));

    await Promise.all(
      responses.map(async (response, i) => {
        if (response.success || !DEAD_TOKEN_CODES.has(response.error?.code ?? '')) return;
        await targets[i].ref.update({ fcmTokens: FieldValue.arrayRemove(targets[i].token) });
      }),
    );
  } catch (err) {
    console.warn('admin push failed:', err);
  }
}
