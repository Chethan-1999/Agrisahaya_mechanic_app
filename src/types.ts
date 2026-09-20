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
  age: string;
  experience: string;
};

export type MechanicStatus = 'pending' | 'active' | 'inactive' | 'rejected';

export type JobStats = {
  pending: number;
  completed: number;
  cancelled: number;
  deleted: number;
};

export type ProfileHistoryEntry = {
  at: string;
  by: string;
  requestId: string;
  changes: Record<string, { from: string | null; to: string }>;
};

export type Mechanic = MechanicForm & {
  id: string;
  status: MechanicStatus;
  paymentVerified: boolean;
  jobStats: JobStats;
  profileHistory: ProfileHistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

/**
 * Display-only mirror of functions/src/lib/params.ts's
 * PROFILE_UPDATE_LIFETIME_CAP default — the server call is the actual
 * enforcement point, this is just a UI hint (the two TS projects don't share
 * a package at this project's size; see EDITABLE_FIELDS in
 * functions/src/profileUpdateFunctions.ts for the same tradeoff).
 */
export const PROFILE_UPDATE_LIFETIME_CAP_DISPLAY = 2;

/** open → assigned → accepted → completed; a declined or moved job comes back as `reassigned` (same as assigned to the technician). See functions/src/lib/jobStatus.ts. */
export type JobStatus = 'open' | 'assigned' | 'reassigned' | 'accepted' | 'declined' | 'completed' | 'cancelled';

export type JobHistoryEntry = {
  action: 'create' | 'edit' | 'assign' | 'reassign' | 'accept' | 'decline' | 'complete' | 'cancel' | 'delete';
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
  history: JobHistoryEntry[];
  /** Who last moved the job into its current status, and when. */
  statusUpdatedBy: string;
  statusUpdatedByRole: 'admin' | 'technician' | '';
  statusUpdatedAt: string;
  /** Soft-deleted jobs are kept for the counts and history but hidden from every list. */
  deleted: boolean;
};

export type ProfileUpdateStatus = 'pending' | 'approved' | 'rejected';

export type ProfileUpdateRequest = {
  id: string;
  technicianId: string;
  changes: Partial<MechanicForm>;
  message: string;
  status: ProfileUpdateStatus;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  adminNote: string | null;
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
  age: '',
  experience: '',
};
