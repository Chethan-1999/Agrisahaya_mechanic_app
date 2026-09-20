import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { PullToRefresh } from '../components/PullToRefresh';
import { formatDate, jobStatusMeta, type ConfirmDialog, type Toast } from '../components/ui';
import { createJob, deleteJob, sortForAdmin, updateJob, visibleJobs } from '../services/jobs';
import { emptyJobFields, type Job, type JobFields } from '../types';

const toDigits = (value: string) => value.replace(/\D/g, '').slice(0, 10);

const toJobFields = (job: Job): JobFields => ({
  farmerName: job.farmerName,
  farmerPhone: job.farmerPhone,
  equipment: job.equipment,
  issue: job.issue,
  district: job.district,
  additionalNotes: job.additionalNotes,
});

export function AdminAddJobs({ askConfirm, jobs, onRefresh, setToast, withLoading }: {
  askConfirm: (dialog: NonNullable<ConfirmDialog>) => void;
  jobs: Job[];
  onRefresh: () => Promise<void>;
  setToast: (toast: Toast) => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFields>(emptyJobFields);
  const [error, setError] = useState('');

  useEffect(() => {
    void onRefresh();
  }, []);

  const board = useMemo(() => sortForAdmin(visibleJobs(jobs)), [jobs]);
  const deletedCount = jobs.filter((job) => job.deleted).length;

  function updateField(key: keyof JobFields, value: string) {
    setForm((current) => ({ ...current, [key]: key === 'farmerPhone' ? toDigits(value) : value }));
    setError('');
  }

  function closeForm() {
    setForm(emptyJobFields);
    setEditingJobId(null);
    setError('');
    setShowForm(false);
  }

  function startNewJob() {
    setForm(emptyJobFields);
    setEditingJobId(null);
    setError('');
    setShowForm(true);
  }

  function startEdit(job: Job) {
    setForm(toJobFields(job));
    setEditingJobId(job.id);
    setError('');
    setShowForm(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const fields = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as JobFields;

    if (!fields.farmerName || !fields.farmerPhone || !fields.equipment || !fields.issue || !fields.district) {
      setError('Customer name, phone number, equipment, issue, and district are required.');
      return;
    }
    if (!/^\d{10}$/.test(fields.farmerPhone)) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    await withLoading(async () => {
      if (editingJobId) {
        await updateJob(editingJobId, fields);
        setToast({ kind: 'success', text: 'Job updated.' });
      } else {
        const jobCode = await createJob(fields);
        setToast({ kind: 'success', text: `Job ${jobCode} added.` });
      }
      closeForm();
      await onRefresh();
    });
  }

  function confirmDelete(job: Job) {
    askConfirm({
      title: 'Delete job?',
      message: `${job.jobCode || 'This job'} will be removed from the boards. The record is kept and counted as deleted${job.technicianId ? ' for the mechanic too' : ''}.`,
      confirmLabel: 'Delete',
      kind: 'danger',
      onConfirm: () => {
        void withLoading(async () => {
          await deleteJob(job.id);
          setToast({ kind: 'success', text: 'Job deleted.' });
          await onRefresh();
        });
      },
    });
  }

  return (
    <PullToRefresh onRefresh={onRefresh}>
    <section>
      <div className="section-heading jobs-heading">
        <h1>Add new jobs</h1>
        <button className="add-job-button" onClick={startNewJob} type="button" aria-label="Add job">
          <span aria-hidden="true">+</span>
          Add job
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <div className="table-wrap jobs-table-wrap">
          <table className="jobs-table">
            <thead><tr><th>Job ID</th><th>Customer name</th><th>Phone number</th><th>Equipment</th><th>Issue</th><th>District</th><th>Additional notes</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {showForm && (
                <tr className="job-entry-row">
                  <td>{editingJobId ? jobs.find((job) => job.id === editingJobId)?.jobCode || '-' : 'New'}</td>
                  <td><input aria-label="Customer name" onChange={(event) => updateField('farmerName', event.target.value)} placeholder="Customer name" value={form.farmerName} /></td>
                  <td><input aria-label="Phone number" inputMode="numeric" maxLength={10} onChange={(event) => updateField('farmerPhone', event.target.value)} pattern="[0-9]*" placeholder="Phone number" value={form.farmerPhone} /></td>
                  <td><input aria-label="Equipment" onChange={(event) => updateField('equipment', event.target.value)} placeholder="Equipment" value={form.equipment} /></td>
                  <td><input aria-label="Issue" onChange={(event) => updateField('issue', event.target.value)} placeholder="Issue" value={form.issue} /></td>
                  <td><input aria-label="District" onChange={(event) => updateField('district', event.target.value)} placeholder="District" value={form.district} /></td>
                  <td><input aria-label="Additional notes" onChange={(event) => updateField('additionalNotes', event.target.value)} placeholder="Additional notes" value={form.additionalNotes} /></td>
                  <td>{editingJobId ? 'Editing' : 'New'}</td>
                  <td>-</td>
                  <td className="actions"><button className="icon-save" title="Save job" type="submit" aria-label="Save job">Save</button><button className="danger-text" onClick={closeForm} type="button">Cancel</button></td>
                </tr>
              )}
              {board.map((job) => {
                const meta = jobStatusMeta(job.status);
                const finished = job.status === 'completed' || job.status === 'cancelled';
                return (
                  <tr className={job.needsReassignment && job.status === 'open' ? 'needs-reassign' : undefined} key={job.id}>
                    <td>{job.jobCode || '-'}</td>
                    <td>{job.farmerName || '-'}</td>
                    <td>{job.farmerPhone || '-'}</td>
                    <td>{job.equipment || job.description}</td>
                    <td>{job.issue || '-'}</td>
                    <td>{job.district || '-'}</td>
                    <td>{job.additionalNotes || '-'}</td>
                    <td><span className={`pill ${meta.pillClass}`}>{meta.label}</span>{job.needsReassignment && job.status === 'open' && <small className="needs-reassign-note">Needs reassignment</small>}</td>
                    <td>{formatDate(job.createdAt)}</td>
                    <td className="actions">
                      {!finished && <button onClick={() => startEdit(job)} type="button">Edit</button>}
                      {(job.status === 'declined' || job.status === 'cancelled' || job.status === 'completed') && <button className="danger-text" onClick={() => confirmDelete(job)} type="button">Delete</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {board.length === 0 && <p className="empty">No jobs saved yet.</p>}
          {deletedCount > 0 && <p className="muted">{deletedCount} deleted {deletedCount === 1 ? 'job' : 'jobs'} on record.</p>}
        </div>
        {error && <p className="error-text">{error}</p>}
      </form>
    </section>
    </PullToRefresh>
  );
}
