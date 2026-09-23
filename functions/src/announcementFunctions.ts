import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAdmin } from './lib/authz';
import { db } from './lib/firebaseAdmin';
import { pushBroadcast } from './lib/push';

const PUSH_BROADCAST_TIMEOUT_MS = 5000;

async function pushBroadcastBestEffort(tokens: string[], payload: Parameters<typeof pushBroadcast>[1]): Promise<void> {
  if (tokens.length === 0) return;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn('broadcast push timed out; announcement was still posted');
      resolve();
    }, PUSH_BROADCAST_TIMEOUT_MS);
  });

  await Promise.race([
    pushBroadcast(tokens, payload).catch((err) => console.warn('broadcast push failed:', err)),
    timeout,
  ]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

/** Admin posts a community broadcast — stored for the technician-facing inbox, then pushed to every active technician's device. */
export const postAnnouncement = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { title, body } = request.data ?? {};

  if (typeof title !== 'string' || !title.trim()) {
    throw new HttpsError('invalid-argument', 'A title is required.');
  }
  if (typeof body !== 'string' || !body.trim()) {
    throw new HttpsError('invalid-argument', 'A message body is required.');
  }

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();

  const ref = db.collection('announcements').doc();
  await ref.set({
    title: trimmedTitle,
    body: trimmedBody,
    createdBy: adminUid,
    createdAt: new Date().toISOString(),
  });

  const activeTechnicians = await db.collection('technicians').where('status', '==', 'active').get();
  const tokens = activeTechnicians.docs
    .map((doc) => doc.data().fcmToken as string | undefined)
    .filter((token): token is string => Boolean(token));

  await pushBroadcastBestEffort(tokens, {
    title: `📢 ${trimmedTitle}`,
    body: trimmedBody.slice(0, 120),
    data: { type: 'announcement', announcementId: ref.id },
  });

  return { status: 'ok', announcementId: ref.id };
});
