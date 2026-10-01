import { BriefcaseBusiness, ClipboardList, Headphones, Megaphone, PhoneCall, UserRound } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { getSettings } from '../../config/settings';
import { useI18n } from '../../i18n/I18nContext';
import type { MechanicPage } from '../MechanicApp';

const mechanicTabs: Array<{ Icon: typeof BriefcaseBusiness; label: string; page: MechanicPage }> = [
  { Icon: BriefcaseBusiness, label: 'Jobs', page: 'mechanicJobs' },
  { Icon: ClipboardList, label: 'Farmers', page: 'mechanicFarmers' },
  { Icon: Megaphone, label: 'Community', page: 'mechanicCommunity' },
  { Icon: UserRound, label: 'Profile', page: 'mechanicProfile' },
];

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" className="whatsapp-icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <path d="M4.4 19.5l1-3.7a8 8 0 1 1 2.9 2.8l-3.9.9Z" fill="currentColor" />
      <path d="M8.7 8.1c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2.1.4 0 .6l-.4.5c-.1.1-.2.3-.1.5.3.6.8 1.2 1.3 1.7.6.5 1.2.9 1.9 1.1.2.1.4 0 .5-.1l.7-.8c.2-.2.4-.2.6-.1l1.6.8c.2.1.4.2.4.4 0 .6-.3 1.3-.7 1.7-.4.3-.9.5-1.5.5-.4 0-1-.1-1.8-.4-1.6-.6-2.9-1.5-4-2.7-1-1.1-1.7-2.2-2.1-3.3-.3-.8-.3-1.4-.2-1.8.1-.4.4-.8.8-1.2Z" fill="white" />
    </svg>
  );
}

export function isMechanicTabPage(page: MechanicPage) {
  return mechanicTabs.some((tab) => tab.page === page);
}

export function MechanicShell({ activePage, children, onNavigate, unreadAnnouncements }: { activePage: MechanicPage; children: ReactNode; onNavigate: (page: MechanicPage) => void; unreadAnnouncements: number }) {
  const { t } = useI18n();
  const [showSupport, setShowSupport] = useState(false);
  const canShowSupport = activePage === 'mechanicJobs';
  const supportPhoneNumber = getSettings().supportPhoneNumber;
  const whatsappNumber = `91${supportPhoneNumber.replace(/\D/g, '')}`;
  const labels: Partial<Record<MechanicPage, string>> = {
    mechanicJobs: t('jobsNav'),
    mechanicFarmers: t('farmersNav'),
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
          <p className="mechanic-welcome-title"><span>Welcome to</span><strong>Agrisahay</strong></p>
          <div className="mechanic-support-area">
            <button aria-expanded={showSupport} aria-label={t('supportLabel')} className="mechanic-help-button" onClick={() => setShowSupport((isVisible) => !isVisible)} type="button">
              <Headphones size={20} strokeWidth={2.5} />
              <span>{t('supportLabel')}</span>
            </button>
            {showSupport && (
              <div className="mechanic-support-popover">
                <span>For Support</span>
                <a href={`tel:${supportPhoneNumber}`}><PhoneCall size={18} strokeWidth={2.6} />{supportPhoneNumber}</a>
                <a href={`https://wa.me/${whatsappNumber}`} rel="noopener noreferrer" target="_blank"><WhatsAppIcon />{supportPhoneNumber}</a>
              </div>
            )}
          </div>
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
