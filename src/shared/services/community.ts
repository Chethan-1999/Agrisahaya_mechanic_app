import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore';

import { db } from '../firebase';
import type { CommunityPost } from '../types';

const collectionName = 'communityPosts';

const toCommunityPost = (id: string, data: Record<string, unknown>): CommunityPost => ({
  id,
  message: String(data.message ?? ''),
  authorName: String(data.authorName ?? 'Admin'),
  createdAt: String(data.createdAt ?? ''),
});

export async function createCommunityPost(message: string, authorName: string) {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, collectionName), {
    message,
    authorName,
    createdAt: now,
  });

  return ref.id;
}

export async function listCommunityPosts() {
  const postsQuery = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(postsQuery);

  return snapshot.docs.map((postDoc) => toCommunityPost(postDoc.id, postDoc.data()));
}