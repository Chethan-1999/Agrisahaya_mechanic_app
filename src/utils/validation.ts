import type { MechanicForm } from '../types';
import { isIndianState } from './indianStates';

export type ValidationErrors = Partial<Record<keyof MechanicForm | 'otp', string>>;

export function isValidPhone(phoneNumber: string) {
  return /^\d{10}$/.test(phoneNumber.trim());
}

export function validateMechanicForm(form: MechanicForm, otpVerified: boolean): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!form.fullName.trim()) {
    errors.fullName = 'Full name is required';
  }

  if (!form.phoneNumber.trim()) {
    errors.phoneNumber = 'Phone number is required';
  } else if (!isValidPhone(form.phoneNumber)) {
    errors.phoneNumber = 'Enter a 10 digit phone number';
  }

  if (!otpVerified) {
    errors.otp = 'OTP verification is required';
  }

  if (!form.village.trim()) {
    errors.village = 'Village is required';
  }

  if (!form.district.trim()) {
    errors.district = 'District is required';
  }

  if (!form.state.trim()) {
    errors.state = 'State is required';
  } else if (!isIndianState(form.state)) {
    errors.state = 'Select a valid Indian state';
  }

  if (form.experience.trim() && Number.isNaN(Number(form.experience))) {
    errors.experience = 'Experience should be numeric';
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors) {
  return Object.keys(errors).length > 0;
}