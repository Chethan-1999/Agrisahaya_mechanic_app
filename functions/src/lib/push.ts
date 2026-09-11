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
