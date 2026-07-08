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

export type AdminProfile = {
  id: string;
  name: string;
  email: string;
  role: 'admin';
};

export type ScreenName =
  | 'landing'
  | 'mechanicAuth'
  | 'mechanicDashboard'
  | 'mechanicProfile'
  | 'mechanicEditProfile'
  | 'adminLogin'
  | 'adminDashboard'
  | 'adminMechanics'
  | 'adminSettings'
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