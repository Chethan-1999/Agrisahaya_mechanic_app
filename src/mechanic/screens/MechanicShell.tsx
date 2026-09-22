import { BriefcaseBusiness, Headphones, PhoneCall, Store, UserRound, UsersRound } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { useI18n } from '../../i18n/I18nContext';
import { SUPPORT_NUMBER } from '../constants';
import type { MechanicPage } from '../MechanicApp';

const mechanicTabs: Array<{ Icon: typeof BriefcaseBusiness; label: string; page: MechanicPage }> = [
  { Icon: BriefcaseBusiness, label: 'Jobs', page: 'mechanicJobs' },
  { Icon: UsersRound, label: 'Community', page: 'mechanicCommunity' },
  { Icon: Store, label: 'Marketplace', page: 'mechanicMarketplace' },
  { Icon: UserRound, label: 'Profile', page: 'mechanicProfile' },
];

export function isMechanicTabPage(page: MechanicPage) {
  return mechanicTabs.some((tab) => tab.page === page);
}

export function MechanicShell({ activePage, children, onNavigate, unreadAnnouncements }: { activePage: MechanicPage; children: ReactNode; onNavigate: (page: MechanicPage) => void; unreadAnnouncements: number }) {
  const { t } = useI18n();
  const [showSupport, setShowSupport] = useState(false);
  const canShowSupport = activePage === 'mechanicJobs';
  const labels: Partial<Record<MechanicPage, string>> = {
    mechanicJobs: t('jobsNav'),
    mechanicCommunity: t('communityNav'),
    mechanicProfile: t('profileNav'),
  };

  useEffect(() => {
    if (!canShowSupport) setShowSupport(false);
  }, [canShowSupport]);

  return (
    <main className="mechanic-app-page">
      <div className="mechanic-app-content">
        {canShowSupport && <div className="mechanic-help-area">
          <button aria-expanded={showSupport} aria-label={t('supportLabel')} className="mechanic-help-button" onClick={() => setShowSupport((isVisible) => !isVisible)} type="button">
            <Headphones size={20} strokeWidth={2.5} />
            <span>{t('supportLabel')}</span>
          </button>
          {showSupport && (
            <div className="mechanic-support-popover">
              <span>For Support</span>
              <a href={`tel:${SUPPORT_NUMBER}`}><PhoneCall size={18} strokeWidth={2.6} />{SUPPORT_NUMBER}</a>
            </div>
          )}
        </div>}
        {children}
      </div>
      <nav className="mechanic-bottom-nav" aria-label="Mechanic navigation">
        {mechanicTabs.map(({ Icon, label, page }) => (
          <button className={activePage === page ? 'active' : ''} key={page} onClick={() => onNavigate(page)} type="button">
            <span><Icon size={19} strokeWidth={2.4} />{page === 'mechanicCommunity' && unreadAnnouncements > 0 && <b>{unreadAnnouncements}</b>}</span>
            {labels[page] ?? label}
          </button>
        ))}
      </nav>
    </main>
  );
}
