import { useEffect, useState, type FormEvent } from 'react';

import { PullToRefresh } from '../../components/PullToRefresh';
import { Input, formatDate, type Toast } from '../../components/ui';
import { listAnnouncements, postAnnouncement } from '../../services/announcements';
import type { Announcement } from '../../types';

const COMMUNITY_TIMEOUT_MS = 15000;

function withCommunityTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), COMMUNITY_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  });
}

export function AdminCommunity({ setToast, withLoading }: {
  setToast: (toast: Toast) => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const [posts, setPosts] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const canPost = Boolean(title.trim() && message.trim());

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    await withLoading(async () => {
      const announcements = await withCommunityTimeout(listAnnouncements(), "Couldn't load community posts — the connection is slow. Pull down to try again.");
      setPosts(announcements);
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canPost) return;
    await withLoading(async () => {
      await withCommunityTimeout(postAnnouncement(title, message), 'Posting timed out — the connection is slow. Check the community list before posting again, so it isn\'t sent twice.');
      setTitle('');
      setMessage('');
      setToast({ kind: 'success', text: 'Posted to the community.' });
      const announcements = await withCommunityTimeout(listAnnouncements(), "Posted, but the list couldn't refresh — the connection is slow. Pull down to refresh.");
      setPosts(announcements);
    });
  }

  return (
    <PullToRefresh onRefresh={refresh}>
      <section className="admin-community-page">
        <div className="admin-community-composer card">
          <p className="eyebrow">Broadcast message</p>
          <h1>Community</h1>
          <p className="muted">Post updates that every mechanic can read after login.</p>
          <form onSubmit={(event) => void submit(event)}>
            <Input label="Title" onChange={setTitle} value={title} />
            <label className="field">
              <span>Write post</span>
              <textarea onChange={(event) => setMessage(event.target.value)} placeholder="Write an update for mechanics..." value={message} />
            </label>
            <button className="primary" disabled={!canPost} type="submit">Post update</button>
          </form>
        </div>

        <div className="admin-community-feed card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Published</p>
              <h2>Community posts</h2>
            </div>
            <span>{posts.length}</span>
          </div>
          <div className="community-post-list admin-feed-list">
            {posts.map((post) => (
              <article className="community-post-card" key={post.id}>
                <div className="community-post-meta"><strong>{post.title}</strong><time>{formatDate(post.createdAt)}</time></div>
                <p>{post.body}</p>
              </article>
            ))}
            {posts.length === 0 && <p className="empty compact-empty">No posts published yet.</p>}
          </div>
        </div>
      </section>
    </PullToRefresh>
  );
}
