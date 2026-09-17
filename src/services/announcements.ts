import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../firebase';
import type { Announcement } from '../types';

const collectionName = 'announcements';

const toAnnouncement = (id: string, data: Record<string, unknown>): Announcement => ({
  id,
  title: String(data.title ?? ''),
  body: String(data.body ?? ''),
  createdBy: String(data.createdBy ?? ''),
  createdAt: String(data.createdAt ?? ''),
});

export async function listAnnouncements() {
  const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toAnnouncement(d.id, d.data()));
}

const postAnnouncementFn = httpsCallable<{ title: string; body: string }, { status: string; announcementId: string }>(
  functions,
  'postAnnouncement',
);

export async function postAnnouncement(title: string, body: string) {
  await postAnnouncementFn({ title, body });
}
