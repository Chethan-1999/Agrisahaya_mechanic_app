import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { farmerMachineryLabel } from '../../../functions/src/shared/farmerMachinery';
import { PullToRefresh } from '../../components/PullToRefresh';
import { farmerStatusMeta, formatDate, type ConfirmDialog, type Toast } from '../../components/ui';
import { resendFarmerSubscriptionSms, reviewFarmerSubscription } from '../../services/farmerSubscriptions';
import type { FarmerSmsStatus, FarmerSubscription, FarmerSubscriptionStatus } from '../../types';

type Filter = FarmerSubscriptionStatus | 'all';

const filters: Array<{ value: Filter; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const smsStatusText: Record<FarmerSmsStatus, string> = {
  'not-configured': 'SMS service not connected yet',
  sent: 'Confirmation SMS sent',
  failed: 'SMS failed — try resending',
};

const machineryText = (request: FarmerSubscription) =>
  request.machinery
    .map((code) => (code === 'other' && request.machineryOther ? `Other: ${request.machineryOther}` : farmerMachineryLabel(code)))
    .join(', ') || '-';

/** Farmer subscription requests from mechanics' referrals: the admin checks each one is genuine, then approves or rejects it. */
export function AdminFarmerSubscriptions({ askConfirm, onRefresh, onUpdated, requests, setToast, withLoading }: {
  askConfirm: (dialog: ConfirmDialog) => void;
  onRefresh: () => Promise<void>;
  onUpdated: (request: FarmerSubscription) => void;
  requests: FarmerSubscription[];
  setToast: (toast: Toast) => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>('pending');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    void onRefresh();
  }, []);

  const counts = useMemo(() => {
    const byStatus: Record<Filter, number> = { pending: 0, approved: 0, rejected: 0, all: requests.length };
    requests.forEach((request) => { byStatus[request.status] += 1; });
    return byStatus;
  }, [requests]);

  const shown = filter === 'all' ? requests : requests.filter((request) => request.status === filter);

  function toggle(id: string) {
    setExpandedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function approve(request: FarmerSubscription) {
    askConfirm({
      title: 'Approve subscription?',
      message: `You confirm ${request.fullName}'s request is genuine. Their Agrisahay Annual Service Plan starts today and a confirmation SMS goes to ${request.phoneNumber}.`,
      confirmLabel: 'Approve Subscription',
      kind: 'primary',
      onConfirm: () => {
        void withLoading(async () => {
          const updated = await reviewFarmerSubscription(request.id, 'approve');
          onUpdated(updated);
          setExpandedIds((current) => (current.includes(updated.id) ? current : [...current, updated.id]));
          setToast({
            kind: 'success',
            text: updated.smsStatus === 'sent' ? `${request.fullName} subscribed. SMS sent.` : `${request.fullName} subscribed. SMS could not be sent; try Resend SMS.`,
          });
        });
      },
    });
  }

  function reject(request: FarmerSubscription) {
    askConfirm({
      title: 'Reject request?',
      message: `${request.fullName}'s subscription request will be rejected. The referring mechanic sees the reason.`,
      confirmLabel: 'Reject',
      kind: 'danger',
      inputLabel: 'Reason (optional, shown to the mechanic)',
      onConfirm: (reason) => {
        void withLoading(async () => {
          onUpdated(await reviewFarmerSubscription(request.id, 'reject', reason));
          setToast({ kind: 'success', text: `${request.fullName}'s request rejected.` });
        });
      },
    });
  }

  function resendSms(request: FarmerSubscription) {
    askConfirm({
      title: 'Resend confirmation SMS?',
      message: `Resend the subscription confirmation SMS to ${request.fullName} at ${request.phoneNumber}?`,
      confirmLabel: 'Resend SMS',
      kind: 'primary',
      onConfirm: () => {
        void withLoading(async () => {
          const updated = await resendFarmerSubscriptionSms(request.id);
          onUpdated(updated);
          setToast(updated.smsStatus === 'sent'
            ? { kind: 'success', text: 'SMS sent.' }
            : { kind: 'error', text: updated.smsStatus === 'failed' ? `SMS failed: ${updated.smsError ?? 'unknown error'}` : 'SMS service not connected yet.' });
        });
      },
    });
  }

  return (
    <PullToRefresh onRefresh={onRefresh}>
      <section>
        <div className="farmer-filter-chips" role="tablist" aria-label="Filter farmer requests">
          {filters.map(({ value, label }) => (
            <button aria-selected={filter === value} className={filter === value ? 'active' : ''} key={value} onClick={() => setFilter(value)} role="tab" type="button">
              {label} <b>{counts[value]}</b>
            </button>
          ))}
        </div>
        <div className="admin-job-card-list">
          {shown.map((request) => {
            const meta = farmerStatusMeta(request.status);
            const isExpanded = expandedIds.includes(request.id);

            return (
              <article className="admin-job-card" key={request.id}>
                <div className="job-card-topline"><span className={`pill ${meta.pillClass}`}>{meta.label}</span><time>{formatDate(request.createdAt)}</time></div>
                <div className="job-card-summary">
                  <div>
                    <h2><span>Farmer</span>{request.fullName}</h2>
                    <p><span>Location</span>{request.village}, {request.mandalDistrict}</p>
                    <p><span>Referred by</span>{request.technicianName || '-'}</p>
                  </div>
                  <div className="admin-job-card-buttons">
                    <button aria-expanded={isExpanded} aria-label={isExpanded ? 'Hide farmer details' : 'Show farmer details'} className="job-show-more" onClick={() => toggle(request.id)} type="button">
                      <span>{isExpanded ? 'Less' : 'More'}</span>
                      <ChevronDown className={isExpanded ? 'open' : ''} size={20} strokeWidth={2.6} />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="job-card-details">
                    <dl>
                      <div><dt>Phone number</dt><dd><a href={`tel:${request.phoneNumber}`}>{request.phoneNumber}</a></dd></div>
                      <div><dt>Pincode</dt><dd>{request.pincode || '-'}</dd></div>
                      <div><dt>State</dt><dd>{request.state || '-'}</dd></div>
                      <div><dt>Machinery owned</dt><dd>{machineryText(request)}</dd></div>
                      <div><dt>Mechanic phone</dt><dd>{request.technicianPhone ? <a href={`tel:${request.technicianPhone}`}>{request.technicianPhone}</a> : '-'}</dd></div>
                      {request.status === 'approved' && (
                        <div><dt>{request.planName ?? 'Plan'}</dt><dd>{formatDate(request.planStartDate ?? '')} – {formatDate(request.planEndDate ?? '')}</dd></div>
                      )}
                      {request.status === 'rejected' && <div><dt>Rejection reason</dt><dd>{request.rejectionReason || '-'}</dd></div>}
                    </dl>
                  </div>
                )}
                {request.status === 'pending' && (
                  <div className="button-row farmer-card-actions">
                    <button className="primary" onClick={() => approve(request)} type="button">Approve Subscription</button>
                    <button className="danger" onClick={() => reject(request)} type="button">Reject</button>
                  </div>
                )}
                {request.status === 'approved' && request.smsMessage && (
                  <div className="farmer-sms-panel">
                    <p className={`farmer-sms-status ${request.smsStatus ?? 'not-configured'}`}>{smsStatusText[request.smsStatus ?? 'not-configured']}</p>
                    <div className="button-row farmer-card-actions">
                      <button className="secondary resend-sms-button" onClick={() => resendSms(request)} type="button">Resend SMS</button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {shown.length === 0 && <p className="empty">{filter === 'pending' ? 'No farmer requests waiting for review.' : 'No farmer requests here.'}</p>}
        </div>
      </section>
    </PullToRefresh>
  );
}
