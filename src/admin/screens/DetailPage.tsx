import { ArrowLeft } from 'lucide-react';

import { DetailGrid } from '../../shared/DetailGrid';
import type { Mechanic } from '../../types';

export function DetailPage({ editable, mechanic, onBack, onEdit, onRequestChange, title }: { editable: boolean; mechanic: Mechanic; onBack: () => void; onEdit?: () => void; onRequestChange?: () => void; title: string }) {
  return (
    <main className="detail-page">
      <section className="card profile-card">
        <button className="text-button back-button" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />Back</button>
        <h1>{title}</h1>
        <h2>{mechanic.fullName}</h2>
        <DetailGrid mechanic={mechanic} />
        {editable && onEdit && <button className="primary" onClick={onEdit}>Edit Profile</button>}
        {onRequestChange && <button className="primary" onClick={onRequestChange}>Request a Change</button>}
      </section>
    </main>
  );
}
