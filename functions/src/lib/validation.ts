import type { Settings } from '../shared/settings';
import { isIndianState } from './indianStates';

export type ProfileInput = {
  fullName: string;
  village: string;
  district: string;
  state: string;
  pincode?: string;
  address?: string;
  landmark?: string;
  age: string;
  experience: string;
};

/** Server-side mirror of the client's form checks — never trust the client alone. */
export function assertValidProfile(
  profile: ProfileInput,
  { technicianMinAge, technicianMaxAge, maxExperienceYears }: Settings,
): void {
  if (!profile.fullName?.trim()) {
    throw new Error('Full name is required.');
  }

  if (!profile.village?.trim()) {
    throw new Error('Village is required.');
  }

  if (!profile.district?.trim()) {
    throw new Error('District is required.');
  }

  if (!profile.state?.trim()) {
    throw new Error('State is required.');
  } else if (!isIndianState(profile.state)) {
    throw new Error('Select a valid Indian state.');
  }

  if (profile.pincode && !/^\d{6}$/.test(profile.pincode.trim())) {
    throw new Error('Pincode must be 6 digits.');
  }

  const age = Number(profile.age);
  if (!Number.isFinite(age) || age < technicianMinAge || age > technicianMaxAge) {
    throw new Error(`Age must be between ${technicianMinAge} and ${technicianMaxAge}.`);
  }

  const experience = Number(profile.experience);
  if (!Number.isFinite(experience) || experience < 0 || experience > maxExperienceYears) {
    throw new Error(`Experience must be between 0 and ${maxExperienceYears} years.`);
  }
}
