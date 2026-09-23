import { formatDate } from '../components/ui';
import type { Mechanic } from '../types';

export function DetailGrid({ compact = false, mechanic }: { compact?: boolean; mechanic: Mechanic }) {
  const rows = [
    ['Phone Number', mechanic.phoneNumber], ['Village', mechanic.village], ['District', mechanic.district],
    ['State', mechanic.state], ['Pincode', mechanic.pincode], ['Address', mechanic.address],
    ['Age', mechanic.age], ['Experience', `${mechanic.experience || '0'} years`], ['Status', mechanic.status],
    ['Jobs', `Pending ${mechanic.jobStats.pending} · Completed ${mechanic.jobStats.completed} · Cancelled ${mechanic.jobStats.cancelled} · Deleted ${mechanic.jobStats.deleted}`],
    ['Registration Date', formatDate(mechanic.createdAt)],
  ];
  return <dl className={compact ? 'detail-grid compact' : 'detail-grid'}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '-'}</dd></div>)}</dl>;
}
