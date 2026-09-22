import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PullToRefresh } from '../../components/PullToRefresh';
import { Input } from '../../components/ui';
import type { Mechanic } from '../../types';

export function MechanicsTable({ mechanics, onApprove, onEdit, onReject, onRefresh, onToggleStatus, onView }: { mechanics: Mechanic[]; onApprove: (mechanic: Mechanic) => void; onEdit: (mechanic: Mechanic) => void; onReject: (mechanic: Mechanic) => void; onRefresh: () => Promise<void>; onToggleStatus: (mechanic: Mechanic) => void; onView: (mechanic: Mechanic) => void }) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  const filtered = useMemo(() => mechanics.filter((mechanic) => {
    if (!query) return true;
    const searchText = [
      mechanic.fullName,
      mechanic.phoneNumber,
      mechanic.village,
      mechanic.district,
      mechanic.state,
      mechanic.pincode,
      mechanic.status,
      mechanic.experience,
      mechanic.age,
    ].join(' ').toLowerCase();
    return searchText.includes(query);
  }), [mechanics, query]);

  return (
    <PullToRefresh onRefresh={onRefresh}>
    <section>
      <div className="section-heading"><h1>Mechanics</h1><button className="secondary refresh-button" onClick={() => void onRefresh()}>Refresh</button></div>
      <div className="card filters">
        <div className="search-field">
          <Input label="Search mechanics" onChange={setSearch} value={search} />
          <Search size={18} aria-hidden="true" />
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Phone Number</th><th>Village</th><th>District</th><th>Experience</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((mechanic) => (
              <tr key={mechanic.id}>
                <td>{mechanic.fullName}</td><td>{mechanic.phoneNumber}</td><td>{mechanic.village}</td><td>{mechanic.district}</td><td>{mechanic.experience}</td>
                <td><span className={`pill ${mechanic.status}`}>{mechanic.status}</span></td>
                <td className="actions">
                  <button onClick={() => onView(mechanic)}>View</button>
                  <button onClick={() => onEdit(mechanic)}>Edit</button>
                  {mechanic.status === 'pending' && (
                    <>
                      <button onClick={() => onApprove(mechanic)}>Approve</button>
                      <button className="danger-text" onClick={() => onReject(mechanic)}>Reject</button>
                    </>
                  )}
                  {(mechanic.status === 'active' || mechanic.status === 'inactive') && (
                    <button className={mechanic.status === 'active' ? 'danger-text' : ''} onClick={() => onToggleStatus(mechanic)}>
                      {mechanic.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">No mechanics found.</p>}
      </div>
    </section>
    </PullToRefresh>
  );
}
