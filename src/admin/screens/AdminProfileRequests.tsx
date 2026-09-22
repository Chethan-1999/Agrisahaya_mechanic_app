import { useEffect, useState } from 'react';

import { PullToRefresh } from '../../components/PullToRefresh';
import { Textarea, formatDate, type Toast } from '../../components/ui';
import { listPendingProfileUpdateRequests, reviewProfileUpdate } from '../../services/profileUpdates';
import type { Mechanic, MechanicForm, ProfileUpdateRequest } from '../../types';

type VisibleProfileField = Exclude<keyof MechanicForm, 'landmark'>;

const FIELD_LABELS: Record<VisibleProfileField, string> = {
  fullName: 'Full Name',
  phoneNumber: 'Phone Number',
  village: 'Village',
  district: 'District',
  state: 'State',
  pincode: 'Pincode',
  address: 'Address',
  age: 'Age',
  experience: 'Experience',
};

function isVisibleProfileField(field: keyof MechanicForm): field is VisibleProfileField {
  return field !== 'landmark';
}

export function AdminProfileRequests({ mechanics, setToast, withLoading }: {
  mechanics: Mechanic[];
  setToast: (toast: Toast) => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const [requests, setRequests] = useState<ProfileUpdateRequest[]>([]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    await withLoading(async () => setRequests(await listPendingProfileUpdateRequests()));
  }

  const technicianName = (id: string) => mechanics.find((mechanic) => mechanic.id === id)?.fullName ?? 'Unknown';

  return (
    <PullToRefresh onRefresh={refresh}>
      <section>
        <div className="section-heading"><h1>Profile change request</h1><button className="secondary refresh-button" onClick={() => void refresh()}>Refresh</button></div>
        {requests.length === 0 && <p className="empty">No pending requests.</p>}
        <div className="request-list">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              onReviewed={refresh}
              request={request}
              setToast={setToast}
              technicianName={technicianName(request.technicianId)}
              withLoading={withLoading}
            />
          ))}
        </div>
      </section>
    </PullToRefresh>
  );
}

function RequestCard({ onReviewed, request, setToast, technicianName, withLoading }: {
  onReviewed: () => Promise<void>;
  request: ProfileUpdateRequest;
  setToast: (toast: Toast) => void;
  technicianName: string;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const [adminNote, setAdminNote] = useState('');

  async function approve() {
    await withLoading(async () => {
      await reviewProfileUpdate(request.id, 'approve');
      setToast({ kind: 'success', text: 'Change approved.' });
      await onReviewed();
    });
  }

  async function reject() {
    await withLoading(async () => {
      await reviewProfileUpdate(request.id, 'reject', adminNote);
      setToast({ kind: 'success', text: 'Change rejected.' });
      await onReviewed();
    });
  }

  const changeEntries = (Object.entries(request.changes) as Array<[keyof MechanicForm, string]>).filter((entry): entry is [VisibleProfileField, string] => isVisibleProfileField(entry[0]));

  return (
    <article className="card request-card">
      <div className="section-heading"><h2>{technicianName}</h2><span className="muted">{formatDate(request.createdAt)}</span></div>
      <p className="muted">&ldquo;{request.message}&rdquo;</p>
      <dl className="detail-grid compact">
        {changeEntries.map(([field, value]) => (
          <div key={field}><dt>{FIELD_LABELS[field]}</dt><dd>{value}</dd></div>
        ))}
      </dl>
         <Textarea label="Note (shown to mechanic if rejected)" onChange={setAdminNote} value={adminNote} />
      <div className="button-row">
        <button className="primary" onClick={() => void approve()} type="button">Approve</button>
        <button className="danger" onClick={() => void reject()} type="button">Reject</button>
      </div>
    </article>
  );
}
