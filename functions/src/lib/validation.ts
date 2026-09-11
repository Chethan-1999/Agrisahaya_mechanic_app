export type ProfileInput = {
  fullName: string;
  village: string;
  district: string;
  state?: string;
  pincode?: string;
  address?: string;
  landmark?: string;
  age: string;
  experience: string;
};

/** Server-side mirror of the client's form checks — never trust the client alone. */
export function assertValidProfile(profile: ProfileInput): void {
  if (!profile.fullName?.trim()) {
    throw new Error('Full name is required.');
  }

  if (!profile.village?.trim()) {
    throw new Error('Village is required.');
  }

  if (!profile.district?.trim()) {
    throw new Error('District is required.');
  }

  if (profile.pincode && !/^\d{6}$/.test(profile.pincode.trim())) {
    throw new Error('Pincode must be 6 digits.');
  }

  const age = Number(profile.age);
  if (!Number.isFinite(age) || age < 18 || age > 70) {
    throw new Error('Age must be between 18 and 70.');
  }

  const experience = Number(profile.experience);
  if (!Number.isFinite(experience) || experience < 0 || experience > 50) {
    throw new Error('Experience must be between 0 and 50 years.');
  }
}
