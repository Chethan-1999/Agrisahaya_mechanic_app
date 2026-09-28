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
