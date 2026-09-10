export type Role = 'mechanic' | 'admin';

export type MechanicForm = {
  fullName: string;
  phoneNumber: string;
  village: string;
  district: string;
  state: string;
  pincode: string;
  address: string;
  age: string;
  experience: string;
};

export type Mechanic = MechanicForm & {
  id: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type JobForm = {
  customerName: string;
  phoneNumber: string;
  equipment: string;
  issue: string;
  district: string;
  additionalNotes: string;
};

export type Job = JobForm & {
  id: string;
  jobId: string;
  assignedMechanicId: string;
  assignedMechanicName: string;
  assignedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunityPost = {
  id: string;
  message: string;
  authorName: string;
  createdAt: string;
};

export type AdminProfile = {
  id: string;
  name: string;
  email: string;
  role: 'admin';
};

export type ScreenName =
  | 'landing'
  | 'mechanicAuth'
  | 'mechanicJobs'
  | 'mechanicCommunity'
  | 'mechanicProfile'
  | 'mechanicEditProfile'
  | 'adminLogin'
  | 'adminDashboard'
  | 'adminMechanics'
  | 'adminJobs'
  | 'adminCommunity'
  | 'adminMechanicDetails'
  | 'adminEditMechanic';

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
  age: '',
  experience: '',
};

export const emptyJobForm: JobForm = {
  customerName: '',
  phoneNumber: '',
  equipment: '',
  issue: '',
  district: '',
  additionalNotes: '',
};