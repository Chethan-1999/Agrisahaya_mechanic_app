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
};

export type Mechanic = MechanicForm & {
  id: string;
  status: MechanicStatus;
  paymentVerified: boolean;
  jobStats: JobStats;
  createdAt: string;
  updatedAt: string;
};

export type JobStatus = 'open' | 'assigned' | 'accepted' | 'declined' | 'completed' | 'cancelled';

export type JobHistoryEntry = {
  action: 'create' | 'assign' | 'accept' | 'decline' | 'complete' | 'cancel';
  by: string;
  at: string;
  [extra: string]: unknown;
};

export type Job = {
  id: string;
  technicianId: string | null;
  farmerName: string;
  farmerPhone: string;
  description: string;
  status: JobStatus;
  createdAt: string;
  createdBy: string;
  cancelledBy: string | null;
  cancelReason: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  history: JobHistoryEntry[];
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
