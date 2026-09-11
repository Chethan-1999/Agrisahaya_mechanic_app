import { useEffect, useMemo, useState } from 'react';

import { Input, Select, Textarea, formatDate, jobStatusMeta, type Toast } from '../components/ui';
import { assignJob, cancelJob, createJob, listAllJobs } from '../services/jobs';
import type { Job, Mechanic } from '../types';

export function AdminJobBoard({ mechanics, setToast, withLoading }: {
  mechanics: Mechanic[];
  setToast: (toast: Toast) => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    await withLoading(async () => setJobs(await listAllJobs()));
  }

  const activeTechnicians = useMemo(() => mechanics.filter((mechanic) => mechanic.status === 'active'), [mechanics]);
  const technicianName = (id: string | null) => (id ? (mechanics.find((mechanic) => mechanic.id === id)?.fullName ?? 'Unknown') : 'Unassigned');

  return (
    <section>
      <div className="section-heading">
        <h1>Job Board</h1>
        <div className="button-row">
          <button className="secondary" onClick={() => void refresh()}>Refresh</button>
          <button className="primary" onClick={() => setShowCreate((current) => !current)}>{showCreate ? 'Close' : 'New Job'}</button>
        </div>
      </div>

      {showCreate && (
        <CreateJobForm
          onCreated={async () => {
            setShowCreate(false);
            setToast({ kind: 'success', text: 'Job logged.' });
            await refresh();
          }}
          setToast={setToast}
          technicians={activeTechnicians}
          withLoading={withLoading}
        />
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Job</th><th>Farmer</th><th>Technician</th><th>Status</th><th>Logged</th><th>Actions</th></tr></thead>
          <tbody>
            {jobs.map((job) => {
              const meta = jobStatusMeta(job.status);
              return (
                <tr key={job.id}>
                  <td>{job.description}</td>
                  <td>{job.farmerName || '-'}{job.farmerPhone ? ` (${job.farmerPhone})` : ''}</td>
                  <td>{technicianName(job.technicianId)}</td>
                  <td><span className={`pill ${meta.pillClass}`}>{meta.label}</span></td>
                  <td>{formatDate(job.createdAt)}</td>
                  <td className="actions">
                    {(job.status === 'open' || job.status === 'declined') && (
                      <ReassignControl
                        onAssign={async (technicianId) => {
                          await withLoading(async () => {
                            await assignJob(job.id, technicianId);
                            setToast({ kind: 'success', text: 'Job assigned.' });
                            await refresh();
                          });
                        }}
                        technicians={activeTechnicians}
                      />
                    )}
                    {(job.status === 'open' || job.status === 'assigned' || job.status === 'accepted') && (
                      <button
                        className="danger-text"
                        onClick={() => {
                          const reason = window.prompt('Reason for cancelling (optional):') ?? undefined;
                          void withLoading(async () => {
                            await cancelJob(job.id, reason);
                            setToast({ kind: 'success', text: 'Job cancelled.' });
                            await refresh();
                          });
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {jobs.length === 0 && <p className="empty">No jobs logged yet.</p>}
      </div>
    </section>
  );
}

function ReassignControl({ onAssign, technicians }: { onAssign: (technicianId: string) => Promise<void>; technicians: Mechanic[] }) {
  const [technicianId, setTechnicianId] = useState('');

  return (
    <span className="inline-assign">
      <select onChange={(event) => setTechnicianId(event.target.value)} value={technicianId}>
        <option value="">Assign to...</option>
        {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.fullName}</option>)}
      </select>
      <button className="text-button" disabled={!technicianId} onClick={() => technicianId && void onAssign(technicianId)} type="button">Assign</button>
    </span>
  );
}

function CreateJobForm({ onCreated, setToast, technicians, withLoading }: {
  onCreated: () => Promise<void>;
  setToast: (toast: Toast) => void;
  technicians: Mechanic[];
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const [technicianId, setTechnicianId] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [farmerPhone, setFarmerPhone] = useState('');
  const [description, setDescription] = useState('');

  async function submit() {
    if (!description.trim()) {
      setToast({ kind: 'error', text: 'Describe the job first.' });
      return;
    }
    await withLoading(async () => {
      await createJob({
        technicianId: technicianId || undefined,
        farmerName,
        farmerPhone,
        description,
      });
      await onCreated();
    });
  }

  return (
    <div className="card form-grid" style={{ marginBottom: 18, padding: 22 }}>
      <Input label="Farmer Name" onChange={setFarmerName} value={farmerName} />
      <Input label="Farmer Phone" onChange={setFarmerPhone} value={farmerPhone} />
      <Textarea label="Job Description" onChange={setDescription} value={description} />
      <Select
        label="Assign To (optional — leave unassigned to assign later)"
        onChange={setTechnicianId}
        options={[['', 'Unassigned'], ...technicians.map((technician): [string, string] => [technician.id, technician.fullName])]}
        value={technicianId}
      />
      <div className="button-row">
        <button className="primary" onClick={() => void submit()} type="button">Log Job</button>
      </div>
    </div>
  );
}
