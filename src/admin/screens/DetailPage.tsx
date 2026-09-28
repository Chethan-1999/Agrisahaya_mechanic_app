import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { listProfileEdits } from '../../services/mechanics';
import { DetailGrid } from '../../shared/DetailGrid';
import type { Mechanic, ProfileEdit } from '../../types';

const SOURCE_LABELS: Record<ProfileEdit['source'], string> = {
  signup: 'Signup',
  reapply: 'Signup sent again',
  technician: 'Edited by mechanic',
  admin: 'Edited by admin',
};

const showValue = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : String(value));

/** Every version of the mechanic's profile, newest first (the `profileEdits` collection). */
function ProfileHistory({ mechanic }: { mechanic: Mechanic }) {
  const [edits, setEdits] = useState<ProfileEdit[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setEdits(null);
    setFailed(false);
    listProfileEdits(mechanic.id).then(setEdits, () => setFailed(true));
  }, [mechanic.id, mechanic.profileVersion]);

  return (
    <section className="profile-history">
      <h3>Profile history <span className="muted">· v{mechanic.profileVersion}</span></h3>
      {failed && <p className="muted">Couldn't load the profile history.</p>}
      {!failed && edits === null && <p className="muted">Loading…</p>}
      {edits?.length === 0 && <p className="muted">No recorded changes yet.</p>}
      {edits && edits.length > 0 && (
        <ol>
          {edits.map((edit) => (
            <li key={edit.id}>
              <strong>v{edit.version} · {SOURCE_LABELS[edit.source] ?? edit.source}</strong>
              <span className="muted"> · {new Date(edit.editedAt).toLocaleString()}</span>
              {edit.source !== 'signup' && (
                <ul>
                  {Object.entries(edit.changes).map(([field, { from, to }]) => (
                    <li key={field}>{field}: {showValue(from)} → {showValue(to)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function DetailPage({ editable, mechanic, onBack, onEdit, title }: { editable: boolean; mechanic: Mechanic; onBack: () => void; onEdit?: () => void; title: string }) {
  return (
    <main className="detail-page">
      <section className="card profile-card">
        <button className="text-button back-button" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />Back</button>
        <h1>{title}</h1>
        <h2>{mechanic.fullName}</h2>
        <DetailGrid mechanic={mechanic} />
        {editable && onEdit && <button className="primary" onClick={onEdit}>Edit Profile</button>}
        <ProfileHistory mechanic={mechanic} />
      </section>
    </main>
  );
}
