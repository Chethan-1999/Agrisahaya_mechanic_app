import type { MechanicForm } from '../types';

export type ValidationErrors = Partial<Record<keyof MechanicForm, string>>;

export function isValidPhone(phoneNumber: string) {
  return /^[6-9]\d{9}$/.test(phoneNumber.trim());
}

/** Firebase Phone Auth requires E.164 — call only after isValidPhone() has confirmed the 10-digit form. */
export function toE164(phoneNumber: string): string {
  return `+91${phoneNumber.trim()}`;
}

/** Mirrors functions/src/lib/validation.ts — the server re-checks all of this too. */
export function validateProfileForm(form: Omit<MechanicForm, 'phoneNumber'>): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!form.fullName.trim()) {
    errors.fullName = 'Full name is required';
  }

  if (!form.village.trim()) {
    errors.village = 'Village is required';
  }

  if (!form.district.trim()) {
    errors.district = 'District is required';
  }

  if (form.pincode.trim() && !/^\d{6}$/.test(form.pincode.trim())) {
    errors.pincode = 'Pincode must be 6 digits';
  }

  const age = Number(form.age);
  if (!form.age.trim() || Number.isNaN(age) || age < 18 || age > 70) {
    errors.age = 'Age must be between 18 and 70';
  }

  const experience = Number(form.experience);
  if (form.experience.trim() && (Number.isNaN(experience) || experience < 0 || experience > 50)) {
    errors.experience = 'Experience must be between 0 and 50 years';
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors) {
  return Object.keys(errors).length > 0;
}
