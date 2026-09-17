import { useEffect, useState } from 'react';

import { PullToRefresh } from '../components/PullToRefresh';
import { formatDate } from '../components/ui';
import { useI18n } from '../i18n/I18nContext';
import { listAnnouncements } from '../services/announcements';
import type { Announcement } from '../types';

export function Announcements({ onBack, withLoading }: {
  onBack: () => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useI18n();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    await withLoading(async () => setAnnouncements(await listAnnouncements()));
  }

  return (
    <PullToRefresh onRefresh={refresh}>
      <main className="detail-page">
        <section className="card profile-card">
          <button className="text-button" onClick={onBack} type="button">{t('back')}</button>
          <h1>{t('announcementsTitle')}</h1>
          {announcements.length === 0 && <p className="muted">{t('noAnnouncementsYet')}</p>}
          <div className="job-list">
            {announcements.map((announcement) => (
              <div className="job-row-button static" key={announcement.id}>
                <span className="jinfo">
                  <b>{announcement.title}</b>
                  <span>{announcement.body}</span>
                </span>
                <span className="muted">{formatDate(announcement.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </PullToRefresh>
  );
}
