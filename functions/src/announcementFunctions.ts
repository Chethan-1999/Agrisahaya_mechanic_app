import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { requireAdmin } from './lib/authz';
import { db } from './lib/firebaseAdmin';
import { pushBroadcast } from './lib/push';

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

  await pushBroadcast(tokens, {
    title: trimmedTitle,
    body: trimmedBody.slice(0, 120),
    data: { type: 'announcement', announcementId: ref.id },
  });

  return { status: 'ok', announcementId: ref.id };
});
