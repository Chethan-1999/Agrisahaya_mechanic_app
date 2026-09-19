import { getMessaging } from 'firebase-admin/messaging';

import { app, db } from './firebaseAdmin';

const messaging = getMessaging(app);

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

/** Best-effort push to one technician's registered device. Never throws — a missing/stale token just means no push goes out. */
export async function pushToTechnician(technicianId: string, payload: PushPayload): Promise<void> {
  const snap = await db.collection('technicians').doc(technicianId).get();
  const token = snap.data()?.fcmToken as string | undefined;

  if (!token) return;

  try {
    await messaging.send({
      token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      android: { priority: 'high' },
    });
  } catch (err) {
    console.warn(`push failed for technician ${technicianId}:`, err);
  }
}

const FCM_BATCH_SIZE = 500; // sendEach's per-call cap

/** Best-effort broadcast to many tokens at once, chunked to FCM's 500-per-call limit. Never throws — same ethos as pushToTechnician. */
export async function pushBroadcast(tokens: string[], payload: PushPayload): Promise<void> {
  for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
    const batch = tokens.slice(i, i + FCM_BATCH_SIZE);

    try {
      await messaging.sendEach(
        batch.map((token) => ({
          token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data,
          android: { priority: 'high' as const },
        })),
      );
    } catch (err) {
      console.warn('broadcast push batch failed:', err);
    }
  }
}

/** Silent data-only push — the client uses this to cancel one specific tagged notification (job:{id}) on the device. */
export async function pushDismiss(technicianId: string, jobId: string): Promise<void> {
  const snap = await db.collection('technicians').doc(technicianId).get();
  const token = snap.data()?.fcmToken as string | undefined;

  if (!token) return;

  try {
    await messaging.send({
      token,
      data: { type: 'dismiss', jobId },
      android: { priority: 'high' },
    });
  } catch (err) {
    console.warn(`dismiss push failed for technician ${technicianId}:`, err);
  }
}
