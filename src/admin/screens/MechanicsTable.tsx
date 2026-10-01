import { RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PullToRefresh } from '../../components/PullToRefresh';
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
      mechanic.machineExpertise,
    ].join(' ').toLowerCase();
    return searchText.includes(query);
  }), [mechanics, query]);

  return (
    <PullToRefresh onRefresh={onRefresh}>
    <section>
      <div className="mechanics-toolbar">
        <label className="admin-job-search mechanics-search" aria-label="Search mechanics">
          <Search size={18} aria-hidden="true" />
          <input onChange={(event) => setSearch(event.target.value)} placeholder="Search mechanics" type="search" value={search} />
        </label>
        <button className="secondary refresh-button mechanics-refresh-button" onClick={() => void onRefresh()} type="button">
          <RefreshCw size={15} aria-hidden="true" />Refresh
        </button>
      </div>
      <div className="table-wrap">
        <table className="mechanics-table">
          <thead><tr><th>Name</th><th>Phone Number</th><th>Village</th><th>District</th><th>Experience</th><th className="mechanics-status-column">Status</th><th className="mechanics-actions-column">Actions</th></tr></thead>
          <tbody>
            {filtered.map((mechanic) => (
              <tr key={mechanic.id}>
                <td>{mechanic.fullName}</td><td>{mechanic.phoneNumber}</td><td>{mechanic.village}</td><td>{mechanic.district}</td><td>{mechanic.experience}</td>
                <td className="mechanics-status-column"><span className={`pill ${mechanic.status}`}>{mechanic.status}</span></td>
                <td className="mechanics-actions-column">
                  <div className="actions mechanics-table-actions">
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
                  </div>
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
