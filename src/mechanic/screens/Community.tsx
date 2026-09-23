import { useEffect, useState } from 'react';

import { PullToRefresh } from '../../components/PullToRefresh';
import { formatDate } from '../../components/ui';
import { useI18n } from '../../i18n/I18nContext';
import { listAnnouncements } from '../../services/announcements';
import type { Announcement } from '../../types';

export function Community({ withLoading }: {
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
      <section className="mechanic-community-screen">
        <div className="mechanic-screen-hero community-hero">
          <div>
            <p className="eyebrow">{t('communityNav')}</p>
            <h1>{t('communityTitle')}</h1>
          </div>
          <span>{announcements.length}</span>
        </div>
        <div className="community-post-list">
          {announcements.map((announcement) => (
            <article className="community-post-card" key={announcement.id}>
              <div className="community-post-meta"><strong>{announcement.title}</strong><time>{formatDate(announcement.createdAt)}</time></div>
              <p>{announcement.body}</p>
            </article>
          ))}
          {announcements.length === 0 && (
            <section className="community-empty-state">
              <span aria-hidden="true">📢</span>
              <h1>{t('noAnnouncementsYet')}</h1>
            </section>
          )}
        </div>
      </section>
    </PullToRefresh>
  );
}
