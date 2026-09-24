import { ChevronDown, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { PullToRefresh } from '../../components/PullToRefresh';
import { formatDate, jobStatusMeta, type Toast } from '../../components/ui';
import { createJob, sortForAdmin, updateJob, visibleJobs } from '../../services/jobs';
import { emptyJobFields, type Job, type JobFields } from '../../types';

const toDigits = (value: string) => value.replace(/\D/g, '').slice(0, 10);

const toJobFields = (job: Job): JobFields => ({
  farmerName: job.farmerName,
  farmerPhone: job.farmerPhone,
  equipment: job.equipment,
  issue: job.issue,
  district: job.district,
  additionalNotes: job.additionalNotes,
});

export function AdminAddJobs({ jobs, onJobSaved, onRefresh, setToast, withLoading }: {
  jobs: Job[];
  onJobSaved: (job: Job) => void;
  onRefresh: () => Promise<void>;
  setToast: (toast: Toast) => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [expandedJobIds, setExpandedJobIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<JobFields>(emptyJobFields);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void onRefresh();
  }, []);

  const board = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const visible = sortForAdmin(visibleJobs(jobs));
    if (!needle) return visible;

    return visible.filter((job) => {
      const meta = jobStatusMeta(job.status);
      return [
        job.jobCode,
        job.farmerName,
        job.farmerPhone,
        job.equipment,
        job.issue,
        job.district,
        job.additionalNotes,
        job.description,
        meta.label,
        job.status,
        formatDate(job.createdAt),
      ].some((value) => String(value ?? '').toLowerCase().includes(needle));
    });
  }, [jobs, search]);
  const deletedCount = jobs.filter((job) => job.deleted).length;
  const editingJob = editingJobId ? jobs.find((job) => job.id === editingJobId) : null;
  const canShowPhone = Boolean(form.farmerName.trim());
  const canShowEquipment = /^\d{10}$/.test(form.farmerPhone);
  const canShowIssue = Boolean(form.equipment.trim());
  const canShowDistrict = Boolean(form.issue.trim());
  const canShowNotes = Boolean(form.district.trim());

  function updateField(key: keyof JobFields, value: string) {
    setForm((current) => ({ ...current, [key]: key === 'farmerPhone' ? toDigits(value) : value }));
    setError('');
  }

  function closeForm() {
    setForm(emptyJobFields);
    setEditingJobId(null);
    setError('');
    setSaving(false);
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

  function toggleJob(jobId: string) {
    setExpandedJobIds((current) => (current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId]));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const fields = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as JobFields;

    if (!fields.farmerName || !fields.farmerPhone || !fields.equipment || !fields.issue || !fields.district) {
      setError('Customer name, phone number, equipment, issue, and district are required.');
      return;
    }
    if (!/^\d{10}$/.test(fields.farmerPhone)) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    setSaving(true);
    try {
      await withLoading(async () => {
        if (editingJobId) {
          onJobSaved(await updateJob(editingJobId, fields));
          setToast({ kind: 'success', text: 'Job updated.' });
        } else {
          const job = await createJob(fields);
          onJobSaved(job);
          setToast({ kind: 'success', text: `Job ${job.jobCode} added.` });
        }
        closeForm();
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PullToRefresh onRefresh={onRefresh}>
    <section>
      <div className="section-heading jobs-heading">
        <label className="admin-job-search" aria-label="Search added jobs">
          <Search size={18} strokeWidth={2.5} aria-hidden="true" />
          <input onChange={(event) => setSearch(event.target.value)} placeholder="Search jobs" type="search" value={search} />
        </label>
        <button className="add-job-button" onClick={startNewJob} type="button" aria-label="Add job">
          <span aria-hidden="true">+</span>
          Add job
        </button>
      </div>
      {showForm && (
        <div className="job-form-backdrop" role="presentation">
          <form aria-label={editingJobId ? 'Edit job' : 'Add job'} className="job-form-modal" onSubmit={(event) => void submit(event)}>
            <div className="job-form-heading">
              <div>
                <p className="eyebrow">{editingJobId ? 'Edit job' : 'New job'}</p>
                <h2>{editingJobId ? 'Update job details' : 'Add job details'}</h2>
              </div>
              <button className="text-button" disabled={saving} onClick={closeForm} type="button">Close</button>
            </div>
            <label className="field"><span>Job ID</span><input disabled value={editingJob?.jobCode || 'Auto generated'} /></label>
            <label className="field"><span>Customer name</span><input autoFocus onChange={(event) => updateField('farmerName', event.target.value)} placeholder="Customer name" value={form.farmerName} /></label>
            {canShowPhone && <label className="field"><span>Phone number</span><input inputMode="numeric" maxLength={10} onChange={(event) => updateField('farmerPhone', event.target.value)} pattern="[0-9]*" placeholder="10 digit phone number" value={form.farmerPhone} /></label>}
            {canShowEquipment && <label className="field"><span>Equipment</span><input onChange={(event) => updateField('equipment', event.target.value)} placeholder="Tractor, pump, harvester..." value={form.equipment} /></label>}
            {canShowIssue && <label className="field"><span>Issue</span><input onChange={(event) => updateField('issue', event.target.value)} placeholder="What problem should the mechanic fix?" value={form.issue} /></label>}
            {canShowDistrict && <label className="field"><span>District</span><input onChange={(event) => updateField('district', event.target.value)} placeholder="District" value={form.district} /></label>}
            {canShowNotes && <label className="field"><span>Additional notes</span><textarea onChange={(event) => updateField('additionalNotes', event.target.value)} placeholder="Optional notes" rows={3} value={form.additionalNotes} /></label>}
            {error && <p className="error-text">{error}</p>}
            <div className="job-form-actions">
              <button className="secondary" disabled={saving} onClick={closeForm} type="button">Cancel</button>
              <button className="primary" disabled={!canShowNotes || saving} type="submit">{saving ? 'Saving...' : editingJobId ? 'Update job' : 'Save job'}</button>
            </div>
          </form>
        </div>
      )}
      <div className="admin-job-card-list">
        {board.map((job) => {
          const meta = jobStatusMeta(job.status);
          const finished = job.status === 'completed' || job.status === 'cancelled';
          const isExpanded = expandedJobIds.includes(job.id);

          return (
            <article className={job.needsReassignment && job.status === 'open' ? 'admin-job-card needs-reassign-card' : 'admin-job-card'} key={job.id}>
              <div className="job-card-topline"><span>{job.jobCode || 'No job ID'}</span><time>{formatDate(job.createdAt)}</time></div>
              <div className="job-card-summary">
                <div>
                  <h2><span>Customer</span>{job.farmerName || '-'}</h2>
                  <p><span>Issue</span>{job.issue || '-'}</p>
                </div>
                <div className="admin-job-card-buttons">
                  {!finished && <button className="secondary admin-card-edit-button" onClick={() => startEdit(job)} type="button">Edit</button>}
                  <button aria-expanded={isExpanded} aria-label={isExpanded ? 'Hide job details' : 'Show job details'} className="job-show-more" onClick={() => toggleJob(job.id)} type="button">
                    <span>{isExpanded ? 'Less' : 'More'}</span>
                    <ChevronDown className={isExpanded ? 'open' : ''} size={20} strokeWidth={2.6} />
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="job-card-details">
                  <dl>
                    <div><dt>Phone number</dt><dd>{job.farmerPhone || '-'}</dd></div>
                    <div><dt>Equipment</dt><dd>{job.equipment || job.description || '-'}</dd></div>
                    <div><dt>District</dt><dd>{job.district || '-'}</dd></div>
                    <div><dt>Additional notes</dt><dd>{job.additionalNotes || '-'}</dd></div>
                    <div><dt>Status</dt><dd><span className={`pill ${meta.pillClass}`}>{meta.label}</span>{job.needsReassignment && job.status === 'open' && <small className="needs-reassign-note">Needs reassignment</small>}</dd></div>
                    <div><dt>Created</dt><dd>{formatDate(job.createdAt)}</dd></div>
                  </dl>
                </div>
              )}
            </article>
          );
        })}
        {board.length === 0 && <p className="empty">{search.trim() ? 'No jobs match your search.' : 'No jobs saved yet.'}</p>}
        {deletedCount > 0 && <p className="muted">{deletedCount} deleted {deletedCount === 1 ? 'job' : 'jobs'} on record.</p>}
      </div>
    </section>
    </PullToRefresh>
  );
}
