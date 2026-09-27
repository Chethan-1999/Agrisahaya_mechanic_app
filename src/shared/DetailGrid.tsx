import type { ReactNode } from 'react';

import { formatDate } from '../components/ui';
import type { Mechanic } from '../types';

function JobStats({ mechanic }: { mechanic: Mechanic }) {
  const stats = [
    ['Pending', mechanic.jobStats.pending],
    ['Completed', mechanic.jobStats.completed],
    ['Cancelled', mechanic.jobStats.cancelled],
  ];

  return (
    <div className="job-stat-list">
      {stats.map(([label, value]) => (
        <span className="job-stat-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </span>
      ))}
    </div>
  );
}

export function DetailGrid({ compact = false, mechanic }: { compact?: boolean; mechanic: Mechanic }) {
  const rows: Array<[string, ReactNode]> = [
    ['Phone Number', mechanic.phoneNumber], ['Village', mechanic.village], ['District', mechanic.district],
    ['State', mechanic.state], ['Pincode', mechanic.pincode], ['Address', mechanic.address],
    ['Age', mechanic.age], ['Experience', `${mechanic.experience || '0'} years`], ['Status', mechanic.status],
    ['Jobs', <JobStats mechanic={mechanic} />],
    ['Registration Date', formatDate(mechanic.createdAt)],
  ];
  return <dl className={compact ? 'detail-grid compact' : 'detail-grid'}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '-'}</dd></div>)}</dl>;
}
