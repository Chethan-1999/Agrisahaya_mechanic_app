import type { PushPayload } from './push';

/**
 * Every push notification's wording, in one place — handlers decide *when* to notify, this file decides *what* it
 * says. `data.type` is what the apps route on (src/services/notifications.ts), so keep those values stable.
 */

type JobRef = { jobCode?: string; description: string };

/** Short label for a push body: the human-readable code when the job has one, else a generic phrase. */
const jobLabel = (job: Pick<JobRef, 'jobCode'>) => (job.jobCode ? `Job ${job.jobCode}` : 'A job');

// ── To a technician ─────────────────────────────────────────────────────────

export const jobAssigned = (jobId: string, description: string, reassigned = false): PushPayload => ({
  title: reassigned ? '🔁 A job just came your way!' : '🔧 New job for you!',
  body: `${description.slice(0, 100)} · Tap to view & accept`,
  data: { type: 'job-assigned', jobId },
});

export const jobDetailsUpdated = (jobId: string, job: JobRef): PushPayload => ({
  title: '✏️ Job details updated',
  body: `${jobLabel(job)} has fresh details — tap to take a look!`,
  data: { type: 'job-updated', jobId },
});

export const jobMovedToAnother = (jobId: string, job: JobRef): PushPayload => ({
  title: '🔄 Job update',
  body: `${jobLabel(job)} has moved to another mechanic. More jobs are on the way!`,
  data: { type: 'job-reassigned', jobId },
});

export const jobMarkedComplete = (jobId: string, job: JobRef): PushPayload => ({
  title: '✅ Job marked complete',
  body: `Great work! ${jobLabel(job)} is now marked completed.`,
  data: { type: 'job-completed', jobId },
});

export const jobCancelled = (jobId: string, job: JobRef): PushPayload => ({
  title: '🚫 Job cancelled',
  body: `${jobLabel(job)} was cancelled. Don't worry — new jobs are coming your way!`,
  data: { type: 'job-cancelled', jobId },
});

export const jobsReleased = (count: number): PushPayload => ({
  title: 'Jobs taken back',
  body: `Your account was deactivated, so ${count} job${count === 1 ? ' was' : 's were'} taken back and will be reassigned. Contact support if this looks wrong.`,
  data: { type: 'jobs-released' },
});

export const accountActivated = (): PushPayload => ({
  title: '🎉 Welcome to Agrisahay!',
  body: "You're verified and ready to go. New jobs will land right here — keep the app handy!",
  data: { type: 'account-activated' },
});

/**
 * The SMS twin of accountActivated (sent through lib/sms.ts), for a technician who isn't watching the app. Plain GSM
 * text with the first name only, so it stays one 160-character SMS part.
 */
export const accountActivatedSms = (fullName: string, supportPhoneNumber: string) =>
  `Agrisahay: Hi ${fullName.trim().split(/\s+/)[0] || 'there'}, your technician account is approved. ` +
  `Open the Agrisahay app to start receiving jobs. Help: ${supportPhoneNumber}`;

export const announcement = (announcementId: string, title: string, body: string): PushPayload => ({
  title: `📢 ${title}`,
  body: body.slice(0, 120),
  data: { type: 'announcement', announcementId },
});

export const farmerRequestReviewed = (requestId: string, farmerName: string, approved: boolean): PushPayload => ({
  title: approved ? '🌾 Farmer subscribed!' : 'Farmer request not approved',
  body: approved
    ? `${farmerName}'s Agrisahay subscription is now active. Thanks for the referral!`
    : `${farmerName}'s subscription request was not approved — tap to see why.`,
  data: { type: 'farmer-request', requestId },
});

// ── To the admins ───────────────────────────────────────────────────────────

const TECHNICIAN_JOB_ACTION_TITLES = {
  accepted: '✅ Job accepted',
  declined: '↩️ Job declined — needs reassigning',
  completed: '🏁 Job completed',
} as const;

export type TechnicianJobAction = keyof typeof TECHNICIAN_JOB_ACTION_TITLES;

export const technicianJobAction = (action: TechnicianJobAction, technicianName: string, jobId: string, job: JobRef): PushPayload => ({
  title: TECHNICIAN_JOB_ACTION_TITLES[action],
  body: `${technicianName} ${action} ${job.jobCode ?? 'a job'} · ${job.description.slice(0, 80)}`,
  data: { type: 'admin-job', jobId },
});

export const newSignup = (technicianId: string, profile: { fullName: string; village: string; district: string }): PushPayload => ({
  title: '🆕 New mechanic signup',
  body: `${profile.fullName} · ${profile.village}, ${profile.district} — tap to review`,
  data: { type: 'admin-signup', technicianId },
});

export const signupResent = (technicianId: string, fullName: string): PushPayload => ({
  title: '🔁 Signup sent again',
  body: `${fullName} updated their rejected signup — tap to review`,
  data: { type: 'admin-signup', technicianId },
});

export const newFarmerRequest = (requestId: string, farmer: { fullName: string; village: string }, technicianName: string): PushPayload => ({
  title: '🌾 New farmer subscription request',
  body: `${farmer.fullName} · ${farmer.village} — referred by ${technicianName}. Tap to review`,
  data: { type: 'admin-farmer-request', requestId },
});
