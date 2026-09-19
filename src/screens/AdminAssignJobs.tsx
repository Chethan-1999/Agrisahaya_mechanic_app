import { useEffect, useMemo, useState } from 'react';

import { PullToRefresh } from '../components/PullToRefresh';
import { jobStatusMeta, type ConfirmDialog, type Toast } from '../components/ui';
import { assignJob, cancelJob, completeJobAsAdmin } from '../services/jobs';
import type { Job, Mechanic } from '../types';

export function AdminAssignJobs({ askConfirm, jobs, mechanics, onRefresh, setToast, withLoading }: {
  askConfirm: (dialog: NonNullable<ConfirmDialog>) => void;
  jobs: Job[];
  mechanics: Mechanic[];
  onRefresh: () => Promise<void>;
  setToast: (toast: Toast) => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void onRefresh();
  }, []);

  const activeTechnicians = useMemo(() => mechanics.filter((mechanic) => mechanic.status === 'active'), [mechanics]);
  const technicianName = (id: string | null) => (id ? (mechanics.find((mechanic) => mechanic.id === id)?.fullName ?? 'Unknown') : '');

  function stopEditing(job: Job) {
    setSelected((current) => ({ ...current, [job.id]: job.technicianId ?? '' }));
    setCompleted((current) => ({ ...current, [job.id]: false }));
    setEditing((current) => ({ ...current, [job.id]: false }));
  }

  function save(job: Job, technicianId: string, markCompleted: boolean) {
    void withLoading(async () => {
      if (technicianId !== (job.technicianId ?? '') || job.status === 'open' || job.status === 'declined') {
        await assignJob(job.id, technicianId);
      }
      if (markCompleted) {
        await completeJobAsAdmin(job.id);
      }
      setToast({ kind: 'success', text: markCompleted ? 'Job assigned and completed.' : 'Job assigned.' });
      stopEditing(job);
      await onRefresh();
    });
  }

  function confirmCancel(job: Job) {
    askConfirm({
      title: 'Cancel job?',
      message: `${job.jobCode || 'This job'} will be cancelled${job.technicianId ? ' and the technician will be notified' : ''}.`,
      confirmLabel: 'Cancel job',
      kind: 'danger',
      onConfirm: () => {
        void withLoading(async () => {
          await cancelJob(job.id);
          setToast({ kind: 'success', text: 'Job cancelled.' });
          await onRefresh();
        });
      },
    });
  }

  return (
    <PullToRefresh onRefresh={onRefresh}>
    <section>
      <div className="section-heading jobs-heading">
        <h1>Assign jobs</h1>
        <p className="muted">Select a technician for each job and save the assignment.</p>
      </div>
      <div className="table-wrap assign-table-wrap">
        <table className="assign-table">
          <thead><tr><th>Job ID</th><th>Customer</th><th>Phone number</th><th>Equipment</th><th>Issue</th><th>District</th><th>Current technician</th><th>Assign technician</th><th>Job completed</th><th>Actions</th></tr></thead>
          <tbody>
            {jobs.map((job) => {
              const meta = jobStatusMeta(job.status);
              const finished = job.status === 'completed' || job.status === 'cancelled';
              const held = job.status === 'assigned' || job.status === 'accepted';
              const isEditing = Boolean(editing[job.id]);
              const locked = finished || (held && !isEditing);
              const technicianId = selected[job.id] ?? job.technicianId ?? '';
              const markCompleted = completed[job.id] ?? false;
              const currentName = technicianName(job.technicianId);
              // A held job's own technician stays selectable even if since deactivated, so the dropdown never shows a blank current value.
              const options = job.technicianId && !activeTechnicians.some((technician) => technician.id === job.technicianId)
                ? [...activeTechnicians, ...mechanics.filter((mechanic) => mechanic.id === job.technicianId)]
                : activeTechnicians;

              return (
                <tr key={job.id}>
                  <td>{job.jobCode || '-'}</td>
                  <td>{job.farmerName || '-'}</td>
                  <td>{job.farmerPhone || '-'}</td>
                  <td>{job.equipment || job.description}</td>
                  <td>{job.issue || '-'}</td>
                  <td>{job.district || '-'}</td>
                  <td>
                    {currentName || finished
                      ? <span className={job.status === 'completed' ? 'assignment-status completed' : 'assignment-status'}><strong>{meta.label.toUpperCase()}</strong>{currentName && <small>{currentName}</small>}</span>
                      : <span className="not-assigned">{job.status === 'declined' ? 'Declined — reassign' : 'Not assigned'}</span>}
                  </td>
                  <td>
                    <select aria-label={`Assign technician for ${job.jobCode || job.farmerName}`} disabled={locked} onChange={(event) => setSelected((current) => ({ ...current, [job.id]: event.target.value }))} value={technicianId}>
                      <option value="">Select technician</option>
                      {options.map((technician) => <option key={technician.id} value={technician.id}>{technician.fullName} - {technician.district}</option>)}
                    </select>
                  </td>
                  <td>
                    {job.status === 'completed' || job.status === 'cancelled' ? (
                      <span className={job.status === 'completed' ? 'completion-chip done' : 'completion-chip pending'}>{job.status === 'completed' ? 'Closed' : 'Cancelled'}</span>
                    ) : locked ? (
                      <span className="completion-chip pending">Open</span>
                    ) : (
                      <label className="job-completed-check"><input checked={markCompleted} disabled={!technicianId} onChange={(event) => setCompleted((current) => ({ ...current, [job.id]: event.target.checked }))} type="checkbox" /> Completed</label>
                    )}
                  </td>
                  <td className="actions">
                    {!finished && (locked
                      ? <button onClick={() => { stopEditing(job); setEditing((current) => ({ ...current, [job.id]: true })); }} type="button">Edit</button>
                      : <button className="icon-save" disabled={!technicianId || (technicianId === (job.technicianId ?? '') && held && !markCompleted)} onClick={() => save(job, technicianId, markCompleted)} type="button">Save</button>)}
                    {isEditing && <button className="danger-text" onClick={() => stopEditing(job)} type="button">Cancel</button>}
                    {!finished && !isEditing && <button className="danger-text" onClick={() => confirmCancel(job)} type="button">Cancel job</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {jobs.length === 0 && <p className="empty">No jobs available to assign.</p>}
        {activeTechnicians.length === 0 && <p className="empty">No active technicians available. Approve technicians before assigning jobs.</p>}
      </div>
    </section>
    </PullToRefresh>
  );
}
