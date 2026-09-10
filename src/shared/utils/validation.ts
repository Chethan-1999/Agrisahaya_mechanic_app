import type { MechanicForm } from '../types';
import type { ValidationMessages } from '../i18n';
import { isIndianState } from './indianStates';

export type ValidationErrors = Partial<Record<keyof MechanicForm | 'otp', string>>;

export function isValidPhone(phoneNumber: string) {
  return /^\d{10}$/.test(phoneNumber.trim());
}

export function validateMechanicForm(form: MechanicForm, otpVerified: boolean, messages?: ValidationMessages): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!form.fullName.trim()) {
    errors.fullName = messages?.validationFullNameRequired ?? 'Full name is required';
  }

  if (!form.phoneNumber.trim()) {
    errors.phoneNumber = messages?.validationPhoneRequired ?? 'Phone number is required';
  } else if (!isValidPhone(form.phoneNumber)) {
    errors.phoneNumber = messages?.validationPhoneInvalid ?? 'Enter a 10 digit phone number';
  }

  if (!otpVerified) {
    errors.otp = messages?.validationOtpRequired ?? 'OTP verification is required';
  }

  if (!form.village.trim()) {
    errors.village = messages?.validationVillageRequired ?? 'Village is required';
  }

  if (!form.district.trim()) {
    errors.district = messages?.validationDistrictRequired ?? 'District is required';
  }

  if (!form.state.trim()) {
    errors.state = messages?.validationStateRequired ?? 'State is required';
  } else if (!isIndianState(form.state)) {
    errors.state = messages?.validationStateInvalid ?? 'Select a valid Indian state';
  }

  if (form.experience.trim() && Number.isNaN(Number(form.experience))) {
    errors.experience = messages?.validationExperienceNumeric ?? 'Experience should be numeric';
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors) {
  return Object.keys(errors).length > 0;
}