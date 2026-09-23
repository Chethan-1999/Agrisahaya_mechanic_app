import { PhoneCall } from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
import type { Mechanic } from '../../types';
import { SUPPORT_NUMBER } from '../constants';

export function MechanicPending({ mechanic, onLogout, onReapply }: { mechanic: Mechanic | null; onLogout: () => void; onReapply: () => void }) {
  const { t } = useI18n();
  const status = mechanic?.status ?? 'pending';
  const heading = status === 'rejected' ? t('rejectedHeading') : status === 'inactive' ? t('inactiveHeading') : t('pendingHeading');
  const body = status === 'rejected' ? t('rejectedBody') : status === 'inactive' ? t('inactiveBody') : t('pendingBody');

  return (
    <main className="mechanic-app-page approval-page">
      <section className="approval-card">
        <div className="approval-badge" aria-hidden="true">{status === 'pending' ? '✓' : '!'}</div>
        <p className="eyebrow">{t('welcome')}</p>
        <h1>{mechanic?.fullName ?? ''}</h1>
        <div className="approval-status-pill">{heading}</div>
        {status === 'pending' && <div className="approval-progress" aria-hidden="true"><span /></div>}
        <p>{body}</p>
        {status === 'rejected' && mechanic?.rejectionReason && <p><strong>{t('rejectionReasonLabel')}:</strong> {mechanic.rejectionReason}</p>}
        {status === 'rejected' && <button className="primary" onClick={onReapply} type="button">{t('reapplyButton')}</button>}
        <p className="support-call-line"><PhoneCall size={16} strokeWidth={2.5} /> For Support Call: <a href={`tel:${SUPPORT_NUMBER}`}>{SUPPORT_NUMBER}</a></p>
        <button className="secondary approval-logout" onClick={onLogout} type="button">{t('logout')}</button>
      </section>
    </main>
  );
}
