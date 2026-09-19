import { useEffect, useState } from 'react';

import { PullToRefresh } from '../components/PullToRefresh';
import { Input, Textarea, formatDate, type Toast } from '../components/ui';
import { listAnnouncements, postAnnouncement } from '../services/announcements';
import type { Announcement } from '../types';

export function AdminAnnouncements({ setToast, withLoading }: {
  setToast: (toast: Toast) => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    await withLoading(async () => setAnnouncements(await listAnnouncements()));
  }

  async function submit() {
    if (!title.trim() || !body.trim()) {
      setToast({ kind: 'error', text: 'Title and message are required.' });
      return;
    }
    await withLoading(async () => {
      await postAnnouncement(title, body);
      setTitle('');
      setBody('');
      setToast({ kind: 'success', text: 'Announcement sent to all active technicians.' });
      await refresh();
    });
  }

  return (
    <PullToRefresh onRefresh={refresh}>
    <section>
      <div className="section-heading">
        <h1>Announcements</h1>
        <button className="secondary" onClick={() => void refresh()}>Refresh</button>
      </div>

      <div className="card form-grid" style={{ marginBottom: 18, padding: 22 }}>
        <Input label="Title" onChange={setTitle} value={title} />
        <Textarea label="Message" onChange={setBody} value={body} />
        <div className="button-row">
          <button className="primary" onClick={() => void submit()} type="button">Send to all technicians</button>
        </div>
      </div>

      <div className="request-list">
        {announcements.map((announcement) => (
          <article className="card request-card" key={announcement.id}>
            <div className="section-heading"><h2>{announcement.title}</h2><span className="muted">{formatDate(announcement.createdAt)}</span></div>
            <p className="muted">{announcement.body}</p>
          </article>
        ))}
        {announcements.length === 0 && <p className="empty">No announcements sent yet.</p>}
      </div>
    </section>
    </PullToRefresh>
  );
}
