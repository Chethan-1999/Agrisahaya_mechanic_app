import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { PullToRefresh } from '../../components/PullToRefresh';
import { formatDate, jobStatusMeta, type Toast } from '../../components/ui';
import { useI18n } from '../../i18n/I18nContext';
import { acceptJob, completeJob, declineJob, listOwnJobs, withJob } from '../../services/jobs';
import type { Job } from '../../types';

export function TechnicianJobs({ setToast, technicianId, withLoading }: {
  setToast: (toast: Toast) => void;
  technicianId: string;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useI18n();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expandedJobIds, setExpandedJobIds] = useState<string[]>([]);

  useEffect(() => {
    void refresh();
  }, [technicianId]);

  async function refresh() {
    await withLoading(async () => setJobs(await listOwnJobs(technicianId)));
  }

  // List order (oldest first) doubles as the "Task N" ordinal — not a stored field.
  const numbered = useMemo(() => jobs.map((job, index) => ({ job, taskNumber: index + 1 })), [jobs]);

  function toggle(jobId: string) {
    setExpandedJobIds((current) => (current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId]));
  }

  // The spinner closes as soon as the action succeeds: the returned job replaces its old copy on screen, and the full
  // list is re-read in the background.
  async function run(action: () => Promise<Job>, toast: string) {
    await withLoading(async () => {
      const job = await action();
      setJobs((current) => withJob(current, job));
      setToast({ kind: 'success', text: toast });
      void listOwnJobs(technicianId).then(setJobs, (error: unknown) => console.warn('Background job refresh failed:', error));
    });
  }

  function decline(job: Job) {
    if (!confirm(t('declineConfirm'))) return;
    void run(() => declineJob(job.id), t('jobDeclinedToast'));
  }

  return (
    <PullToRefresh onRefresh={refresh}>
      <section className="mechanic-jobs-screen">
        <div className="mechanic-screen-hero jobs-hero">
          <div>
            <p className="eyebrow">{t('jobsNav')}</p>
            <h1>{t('jobsTitle')}</h1>
          </div>
          <span>{numbered.length}</span>
        </div>
        <div className="mechanic-job-list">
          {numbered.map(({ job, taskNumber }) => {
            const meta = jobStatusMeta(job.status, t);
            const isExpanded = expandedJobIds.includes(job.id);
            return (
              <article className={job.status === 'completed' ? 'mechanic-job-card completed' : 'mechanic-job-card'} key={job.id}>
                <div className="job-card-summary">
                  <div>
                    <div className="job-card-topline"><span>{job.jobCode || `${t('task')} ${taskNumber}`}</span><time>{formatDate(job.createdAt)}</time></div>
                    <h2><span>Equipment</span>{job.equipment || job.description}</h2>
                    {job.issue && <p><span>Issue</span>{job.issue}</p>}
                  </div>
                  <button aria-expanded={isExpanded} aria-label={isExpanded ? 'Hide job details' : 'Show job details'} className="job-show-more" onClick={() => toggle(job.id)} type="button">
                    <span>{isExpanded ? 'Less' : 'More'}</span>
                    <ChevronDown className={isExpanded ? 'open' : ''} size={20} strokeWidth={2.6} />
                  </button>
                </div>
                {isExpanded && (
                  <div className="job-card-details">
                    <dl>
                      <div><dt>{t('farmerLabel')}</dt><dd>{job.farmerName || '-'}</dd></div>
                      <div><dt>{t('farmerPhoneLabel')}</dt><dd>{job.farmerPhone ? <a href={`tel:${job.farmerPhone}`}>{job.farmerPhone}</a> : '-'}</dd></div>
                      <div><dt>District</dt><dd>{job.district || '-'}</dd></div>
                      <div><dt>Notes</dt><dd>{job.additionalNotes || '-'}</dd></div>
                      <div><dt>{t('statusLabel')}</dt><dd><span className={`pill ${meta.pillClass}`}>{meta.label}</span></dd></div>
                    </dl>
                  </div>
                )}
                {(job.status === 'assigned' || job.status === 'reassigned' || job.status === 'accepted') && (
                  <div className="button-row" style={{ marginTop: 14 }}>
                    {(job.status === 'assigned' || job.status === 'reassigned') && (
                      <>
                        <button className="primary" onClick={() => void run(() => acceptJob(job.id), t('jobAcceptedToast'))} type="button">{t('accept')}</button>
                        <button className="danger" onClick={() => decline(job)} type="button">{t('decline')}</button>
                      </>
                    )}
                    {job.status === 'accepted' && <button className="primary" onClick={() => void run(() => completeJob(job.id), t('jobCompletedToast'))} type="button">{t('markComplete')}</button>}
                  </div>
                )}
              </article>
            );
          })}
          {numbered.length === 0 && (
            <section className="jobs-empty-state">
              <span aria-hidden="true">🧰</span>
              <h1>{t('noJobsYet')}</h1>
            </section>
          )}
        </div>
      </section>
    </PullToRefresh>
  );
}
