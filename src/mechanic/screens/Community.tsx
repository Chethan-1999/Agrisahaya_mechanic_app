import { useEffect, useState, type ReactNode } from 'react';

import { PullToRefresh } from '../../components/PullToRefresh';
import { formatDate } from '../../components/ui';
import { useI18n } from '../../i18n/I18nContext';
import { listAnnouncements } from '../../services/announcements';
import type { Announcement } from '../../types';

const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

function normalizeUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
}

function splitTrailingPunctuation(url: string) {
  const match = url.match(/^(.+?)([.,!?;:)\]]*)$/);
  return { cleanUrl: match?.[1] ?? url, trailing: match?.[2] ?? '' };
}

function LinkifiedPostBody({ body }: { body: string }) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of body.matchAll(urlPattern)) {
    const rawUrl = match[0];
    const index = match.index ?? 0;
    const { cleanUrl, trailing } = splitTrailingPunctuation(rawUrl);
    const href = normalizeUrl(cleanUrl);

    if (index > lastIndex) parts.push(body.slice(lastIndex, index));
    parts.push(
      <a className="community-post-link" href={href} key={`${href}-${index}`} rel="noopener noreferrer" target="_blank">{cleanUrl}</a>,
    );
    if (trailing) parts.push(trailing);
    lastIndex = index + rawUrl.length;
  }

  if (lastIndex < body.length) parts.push(body.slice(lastIndex));
  return <p className="community-post-body">{parts.length ? parts : body}</p>;
}

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
              <LinkifiedPostBody body={announcement.body} />
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
