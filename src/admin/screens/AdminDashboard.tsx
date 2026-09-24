import { BriefcaseBusiness, CircleCheck, CircleDot, Clock3, Users, UserX } from 'lucide-react';

import { Metric, jobStatusMeta } from '../../components/ui';
import { getInitials } from '../../shared/formatting';
import type { Job, Mechanic } from '../../types';

// Jobs count as "assigned" once a technician holds them (assigned → accepted → completed); open/cancelled/declined don't.
function isAssignedJob(job: Job) {
  return job.status === 'assigned' || job.status === 'reassigned' || job.status === 'accepted' || job.status === 'completed';
}

export function AdminDashboard({ active, inactive, jobs, mechanics, pending, total }: { active: number; inactive: number; jobs: Job[]; mechanics: Mechanic[]; pending: number; total: number }) {
  const assignedJobs = jobs.filter(isAssignedJob).length;
  const openJobs = jobs.filter((job) => job.status === 'open').length;
  const assignmentRate = jobs.length ? Math.round((assignedJobs / jobs.length) * 100) : 0;
  const recentJobs = jobs.slice(0, 5);
  const topMechanics = mechanics
    .map((mechanic) => ({ mechanic, count: jobs.filter((job) => job.technicianId === mechanic.id && isAssignedJob(job)).length }))
    .filter((item) => item.count > 0)
    .sort((first, second) => second.count - first.count)
    .slice(0, 4);

  return (
    <section className="admin-dashboard-page">
      <div className="admin-dashboard-hero">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>Admin Dashboard</h1>
          <p>Track mechanics, jobs, and assignments from one place.</p>
        </div>
        <div className="dashboard-rate-card">
          <span>{assignmentRate}%</span>
          <p>Jobs assigned</p>
        </div>
      </div>

      <section className="dashboard-metrics-grid">
        <Metric icon={<Users size={20} strokeWidth={2.5} />} label="Total Mechanics" value={total} />
        <Metric icon={<Clock3 size={20} strokeWidth={2.5} />} label="Pending Approval" value={pending} />
        <Metric icon={<CircleCheck size={20} strokeWidth={2.5} />} label="Active" value={active} />
        <Metric icon={<UserX size={20} strokeWidth={2.5} />} label="Inactive / Rejected" value={inactive} />
        <Metric icon={<BriefcaseBusiness size={20} strokeWidth={2.5} />} label="Total jobs" value={jobs.length} />
        <Metric icon={<CircleDot size={20} strokeWidth={2.5} />} label="Open jobs" value={openJobs} />
      </section>

      <section className="dashboard-panels">
        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Latest work</p>
              <h2>Recent jobs</h2>
            </div>
            <span>{recentJobs.length}</span>
          </div>
          <div className="recent-job-list">
            {recentJobs.map((job) => {
              const meta = jobStatusMeta(job.status);
              return (
                <div className="recent-job-item" key={job.id}>
                  <div>
                    <strong>{job.jobCode || job.farmerName || '-'}</strong>
                    <p>{job.equipment ? `${job.equipment} - ${job.issue}` : job.description}</p>
                  </div>
                  <span className={`pill ${meta.pillClass}`}>{meta.label}</span>
                </div>
              );
            })}
            {recentJobs.length === 0 && <p className="empty compact-empty">No jobs added yet.</p>}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Assignment load</p>
              <h2>Top mechanics</h2>
            </div>
            <span>{topMechanics.length}</span>
          </div>
          <div className="mechanic-load-list">
            {topMechanics.map(({ count, mechanic }) => (
              <div className="mechanic-load-item" key={mechanic.id}>
                <div className="load-avatar">{getInitials(mechanic.fullName)}</div>
                <div>
                  <strong>{mechanic.fullName}</strong>
                  <p>{mechanic.district || '-'} · {mechanic.experience || '0'} yrs</p>
                </div>
                <span>{count}</span>
              </div>
            ))}
            {topMechanics.length === 0 && <p className="empty compact-empty">No assigned jobs yet.</p>}
          </div>
        </article>
      </section>
    </section>
  );
}
