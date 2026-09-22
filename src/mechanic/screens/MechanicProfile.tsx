import { PullToRefresh } from '../../components/PullToRefresh';
import { useI18n } from '../../i18n/I18nContext';
import { DetailGrid } from '../../shared/DetailGrid';
import { getInitials } from '../../shared/formatting';
import type { Mechanic } from '../../types';

export function MechanicProfile({ mechanic, onLogout, onRefresh, onRequestChange }: { mechanic: Mechanic; onLogout: () => void; onRefresh: () => Promise<void>; onRequestChange: () => void }) {
  const { t } = useI18n();

  return (
    <PullToRefresh onRefresh={onRefresh}>
      <section className="mechanic-profile-screen">
        <div className="mechanic-profile-hero">
          <div className="profile-avatar">{getInitials(mechanic.fullName)}</div>
          <p className="eyebrow">{t('welcome')}</p>
          <h1>{mechanic.fullName}</h1>
          <div className="profile-chip-row">
            <span>{mechanic.status}</span>
            <span>{mechanic.experience || '0'} yrs</span>
            <span>{mechanic.district || '-'}</span>
          </div>
          <button className="primary profile-edit-button" onClick={onRequestChange} type="button">{t('requestChangeNav')}</button>
        </div>
        <section className="profile-details-card">
          <h2>{t('profileNav')}</h2>
          <DetailGrid mechanic={mechanic} compact />
        </section>
        <button className="secondary profile-logout-button" onClick={onLogout} type="button">{t('logout')}</button>
      </section>
    </PullToRefresh>
  );
}
