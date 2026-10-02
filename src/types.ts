export type Role = 'mechanic' | 'admin';

export type MechanicForm = {
  fullName: string;
  phoneNumber: string;
  village: string;
  district: string;
  state: string;
  pincode: string;
  address: string;
  landmark: string;
  machineExpertise: string;
  experience: string;
};

export type MechanicStatus = 'pending' | 'active' | 'inactive' | 'rejected';

export type JobStats = {
  pending: number;
  completed: number;
  cancelled: number;
  deleted: number;
};

/** One version of a technician's profile — a doc in `profileEdits`. See functions/src/lib/profileEdits.ts. */
export type ProfileEdit = {
  id: string;
  technicianId: string;
  version: number;
  source: 'signup' | 'reapply' | 'technician' | 'admin';
  editedBy: string;
  editedAt: string;
  changes: Record<string, { from: unknown; to: string | null }>;
};

export type Mechanic = MechanicForm & {
  id: string;
  status: MechanicStatus;
  paymentVerified: boolean;
  rejectionReason: string | null;
  jobStats: JobStats;
  /** Earned by referring farmers; only ever incremented server-side (reviewFarmerSubscription). */
  walletPoints: number;
  profileVersion: number;
  createdAt: string;
  updatedAt: string;
};

/** open → assigned → accepted → completed; a declined or moved job comes back as `reassigned` (same as assigned to the technician). See functions/src/lib/jobStatus.ts. */
export type JobStatus = 'open' | 'assigned' | 'reassigned' | 'accepted' | 'declined' | 'completed' | 'cancelled';

export type JobHistoryEntry = {
  action: 'create' | 'edit' | 'assign' | 'reassign' | 'release' | 'accept' | 'decline' | 'complete' | 'cancel' | 'delete';
  by: string;
  at: string;
  [extra: string]: unknown;
};

export type JobFields = {
  farmerName: string;
  farmerPhone: string;
  equipment: string;
  issue: string;
  district: string;
  additionalNotes: string;
};

export const emptyJobFields: JobFields = {
  farmerName: '',
  farmerPhone: '',
  equipment: '',
  issue: '',
  district: '',
  additionalNotes: '',
};

export type Job = JobFields & {
  id: string;
  jobCode: string;
  technicianId: string | null;
  description: string;
  status: JobStatus;
  createdAt: string;
  createdBy: string;
  cancelledBy: string | null;
  cancelReason: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  /** Who last moved the job into its current status, and when. */
  statusUpdatedBy: string;
  statusUpdatedByRole: 'admin' | 'technician' | '';
  statusUpdatedAt: string;
  /** Soft-deleted jobs are kept for the counts and history but hidden from every list. */
  deleted: boolean;
  /** Taken back from a deactivated technician and waiting to be assigned again. */
  needsReassignment: boolean;
  history: JobHistoryEntry[];
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
};

export type AdminProfile = {
  id: string;
  name: string;
  email: string;
  role: 'admin';
};

export type AppSession =
  | { role: 'mechanic'; mechanicId: string }
  | { role: 'admin'; admin: AdminProfile }
  | null;

export const emptyMechanicForm: MechanicForm = {
  fullName: '',
  phoneNumber: '',
  village: '',
  district: '',
  state: '',
  pincode: '',
  address: '',
  landmark: '',
  machineExpertise: '',
  experience: '',
};

/** The subscription form a mechanic fills in for a farmer they refer. Mirrors functions/src/lib/farmerValidation.ts. */
export type FarmerSubscriptionForm = {
  fullName: string;
  /** 10 digits in the form; stored normalized as +91XXXXXXXXXX. */
  phoneNumber: string;
  village: string;
  mandalDistrict: string;
  pincode: string;
  state: string;
  /** Codes from functions/src/shared/farmerMachinery.ts. */
  machinery: string[];
  machineryOther: string;
};

export const emptyFarmerSubscriptionForm: FarmerSubscriptionForm = {
  fullName: '',
  phoneNumber: '',
  village: '',
  mandalDistrict: '',
  pincode: '',
  state: '',
  machinery: [],
  machineryOther: '',
};

/** pending → approved (plan starts, confirmation SMS) | rejected. See functions/src/farmerSubscriptionFunctions.ts. */
export type FarmerSubscriptionStatus = 'pending' | 'approved' | 'rejected';

/** How a server SMS went — see `SmsStatus` in functions/src/lib/sms.ts. `queued` = the gateway phone is offline. */
export type SmsStatus = 'not-configured' | 'sent' | 'queued' | 'failed';

/** A technician-approval SMS's outcome as `reviewSignup` returns it; `error` states the problem in a few words. */
export type SmsOutcome = { status: SmsStatus; error?: string; phoneNumber: string; message: string };

/** A doc in `farmerSubscriptions`. */
export type FarmerSubscription = FarmerSubscriptionForm & {
  id: string;
  technicianId: string;
  technicianName: string;
  technicianPhone: string;
  status: FarmerSubscriptionStatus;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  planName: string | null;
  planStartDate: string | null;
  planEndDate: string | null;
  smsMessage: string | null;
  /** The confirmation SMS's last send — null until approval. See farmerSubscriptionFunctions.ts. */
  smsStatus: SmsStatus | null;
  smsError: string | null;
  smsVia: 'gateway' | 'admin-phone' | null;
  smsByName: string | null;
  smsAt: string | null;
};
