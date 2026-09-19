import { useEffect, useMemo, useState } from 'react';

import { PullToRefresh } from '../components/PullToRefresh';
import { jobStatusMeta, type Toast } from '../components/ui';
import { useI18n } from '../i18n/I18nContext';
import { acceptJob, completeJob, declineJob, listOwnJobs } from '../services/jobs';
import type { Job } from '../types';


export function TechnicianJobs({ setToast, technicianId, withLoading }: {
  setToast: (toast: Toast) => void;
  technicianId: string;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useI18n();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [technicianId]);

  async function refresh() {
    await withLoading(async () => setJobs(await listOwnJobs(technicianId)));
  }

  // List order (oldest first) doubles as the "Task N" ordinal — not a stored field.
  const numbered = useMemo(() => jobs.map((job, index) => ({ job, taskNumber: index + 1 })), [jobs]);
  const selected = numbered.find((entry) => entry.job.id === selectedJobId);
  const isOpenForAction = (job: Job) => job.status === 'assigned' || job.status === 'accepted';

  if (selected && isOpenForAction(selected.job)) {
    return (
      <JobDetail
        job={selected.job}
        onBack={() => setSelectedJobId(null)}
        onChanged={async () => {
          setSelectedJobId(null);
          await refresh();
        }}
        setToast={setToast}
        taskNumber={selected.taskNumber}
        withLoading={withLoading}
      />
    );
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
        {numbered.length === 0 && (
          <section className="jobs-empty-state">
            <span aria-hidden="true">🧰</span>
            <h1>{t('noJobsYet')}</h1>
          </section>
        )}
        <div className="job-list">
          {numbered.map(({ job, taskNumber }) => {
            const meta = jobStatusMeta(job.status, t);
            const clickable = isOpenForAction(job);
            return (
              <button
                className={`job-row-button ${clickable ? '' : 'static'}`}
                disabled={!clickable}
                key={job.id}
                onClick={() => clickable && setSelectedJobId(job.id)}
              >
                <span className="tnum">{t('task')} {taskNumber}</span>
                <span className="jinfo">
                  <b>{job.description}</b>
                  <span>{t('farmerLabel')}: {job.farmerName || '-'}</span>
                </span>
                <span className={`pill ${meta.pillClass}`}>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </PullToRefresh>
  );
}

function JobDetail({ job, onBack, onChanged, setToast, taskNumber, withLoading }: {
  job: Job;
  onBack: () => void;
  onChanged: () => Promise<void>;
  setToast: (toast: Toast) => void;
  taskNumber: number;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useI18n();

  async function accept() {
    await withLoading(async () => {
      await acceptJob(job.id);
      setToast({ kind: 'success', text: t('jobAcceptedToast') });
      await onChanged();
    });
  }

  async function decline() {
    if (!confirm(t('declineConfirm'))) return;
    await withLoading(async () => {
      await declineJob(job.id);
      setToast({ kind: 'success', text: t('jobDeclinedToast') });
      await onChanged();
    });
  }

  async function complete() {
    await withLoading(async () => {
      await completeJob(job.id);
      setToast({ kind: 'success', text: t('jobCompletedToast') });
      await onChanged();
    });
  }

  return (
    <main className="detail-page">
      <section className="card profile-card">
        <button className="text-button" onClick={onBack} type="button">{t('back')}</button>
        <h1>{t('task')} {taskNumber}</h1>
        <dl className="detail-grid">
          <div><dt>{t('descriptionLabel')}</dt><dd>{job.description}</dd></div>
          <div><dt>{t('farmerLabel')}</dt><dd>{job.farmerName || '-'}</dd></div>
          <div><dt>{t('farmerPhoneLabel')}</dt><dd>{job.farmerPhone ? <a href={`tel:${job.farmerPhone}`}>{job.farmerPhone}</a> : '-'}</dd></div>
          <div><dt>{t('statusLabel')}</dt><dd>{jobStatusMeta(job.status, t).label}</dd></div>
        </dl>
        <div className="button-row">
          {job.status === 'assigned' && (
            <>
              <button className="primary" onClick={() => void accept()} type="button">{t('accept')}</button>
              <button className="danger" onClick={() => void decline()} type="button">{t('decline')}</button>
            </>
          )}
          {job.status === 'accepted' && <button className="primary" onClick={() => void complete()} type="button">{t('markComplete')}</button>}
        </div>
      </section>
    </main>
  );
}
