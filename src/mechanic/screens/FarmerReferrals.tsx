import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PullToRefresh } from '../../components/PullToRefresh';
import { farmerStatusMeta, formatDate } from '../../components/ui';
import { useI18n } from '../../i18n/I18nContext';
import { listOwnFarmerSubscriptions } from '../../services/farmerSubscriptions';
import type { FarmerSubscription } from '../../types';
import { machineryText } from './FarmerSubscriptionForm';

/** The farmers this mechanic has referred for a subscription, and the way to add another. */
export function FarmerReferrals({ onAddFarmer, technicianId, withLoading }: {
  onAddFarmer: () => void;
  technicianId: string;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useI18n();
  const [requests, setRequests] = useState<FarmerSubscription[]>([]);

  useEffect(() => {
    void refresh();
  }, [technicianId]);

  async function refresh() {
    await withLoading(async () => setRequests(await listOwnFarmerSubscriptions(technicianId)));
  }

  return (
    <PullToRefresh onRefresh={refresh}>
      <section className="mechanic-jobs-screen">
        <div className="mechanic-screen-hero jobs-hero">
          <div>
            <p className="eyebrow">{t('farmersNav')}</p>
            <h1>{t('farmersTitle')}</h1>
          </div>
          <span>{requests.length}</span>
        </div>
        <p className="muted farmer-referrals-hint">{t('farmersHint')}</p>
        <button className="primary farmer-add-button" onClick={onAddFarmer} type="button"><Plus size={18} aria-hidden="true" />{t('addFarmer')}</button>
        <div className="mechanic-job-list">
          {requests.map((request) => {
            const meta = farmerStatusMeta(request.status, t);
            return (
              <article className="mechanic-job-card" key={request.id}>
                <div className="job-card-topline"><span className={`pill ${meta.pillClass}`}>{meta.label}</span><time>{formatDate(request.createdAt)}</time></div>
                <h2><span>{t('farmerName')}</span>{request.fullName}</h2>
                <p><span>{t('villageLocation')}</span>{request.village}, {request.mandalDistrict}</p>
                <p><span>{t('machineryOwned')}</span>{machineryText(request, t)}</p>
                {request.status === 'approved' && request.planStartDate && request.planEndDate && (
                  <p><span>{t('planActiveLabel')}</span>{formatDate(request.planStartDate)} – {formatDate(request.planEndDate)}</p>
                )}
                {request.status === 'rejected' && request.rejectionReason && (
                  <p className="error-text"><span>{t('rejectionReasonLabel')}</span>{request.rejectionReason}</p>
                )}
              </article>
            );
          })}
          {requests.length === 0 && (
            <section className="jobs-empty-state">
              <span aria-hidden="true">🌾</span>
              <p>{t('noFarmersYet')}</p>
            </section>
          )}
        </div>
      </section>
    </PullToRefresh>
  );
}
