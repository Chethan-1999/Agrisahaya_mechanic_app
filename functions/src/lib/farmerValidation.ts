import { HttpsError } from 'firebase-functions/v2/https';

import { isFarmerMachineryCode, type FarmerMachineryCode } from '../shared/farmerMachinery';
import { indianStates } from '../shared/indianStates';
import { normalizePhone } from './phone';

/**
 * The fields of a farmer subscription request — the whole form a mechanic fills in for a farmer. Mirrors
 * FarmerSubscriptionForm (src/types.ts). Any other key is refused by name, like a profile edit's (validation.ts).
 */
export const FARMER_FIELDS = ['fullName', 'phoneNumber', 'village', 'mandalDistrict', 'pincode', 'state', 'machinery', 'machineryOther'] as const;

export type FarmerSubscriptionInput = {
  fullName: string;
  phoneNumber: string; // normalized +91XXXXXXXXXX
  village: string;
  mandalDistrict: string;
  pincode: string;
  state: string; // canonical spelling from indianStates
  machinery: FarmerMachineryCode[];
  machineryOther: string;
};

const MAX_TEXT = 120;

const text = (raw: Record<string, unknown>, field: string, label: string, required = true): string => {
  const value = raw[field];

  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${label} must be text.`);
  }

  const trimmed = (value ?? '').trim();

  if (required && !trimmed) throw new HttpsError('invalid-argument', `${label} is required.`);
  if (trimmed.length > MAX_TEXT) throw new HttpsError('invalid-argument', `${label} is too long.`);

  return trimmed;
};

/** Server-side mirror of the mechanic app's farmer form checks (src/utils/validation.ts) — never trust the client alone. */
export function parseFarmerSubscription(raw: unknown): FarmerSubscriptionInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HttpsError('invalid-argument', 'farmer is required.');
  }

  const data = raw as Record<string, unknown>;

  for (const field of Object.keys(data)) {
    if (!(FARMER_FIELDS as readonly string[]).includes(field)) {
      throw new HttpsError('invalid-argument', `"${field}" is not part of the subscription form.`);
    }
  }

  let phoneNumber: string;
  try {
    phoneNumber = normalizePhone(text(data, 'phoneNumber', 'Phone number'));
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('invalid-argument', 'Enter a valid 10-digit mobile number.');
  }

  const pincode = text(data, 'pincode', 'Pincode');
  if (!/^\d{6}$/.test(pincode)) throw new HttpsError('invalid-argument', 'Pincode must be 6 digits.');

  const stateInput = text(data, 'state', 'State').toLowerCase();
  const state = indianStates.find((name) => name.toLowerCase() === stateInput);
  if (!state) throw new HttpsError('invalid-argument', 'Select a valid Indian state.');

  if (!Array.isArray(data.machinery) || data.machinery.length === 0) {
    throw new HttpsError('invalid-argument', 'Select at least one machine the farmer owns.');
  }
  if (!data.machinery.every(isFarmerMachineryCode)) {
    throw new HttpsError('invalid-argument', 'Unknown machinery type.');
  }
  const machinery = [...new Set(data.machinery as FarmerMachineryCode[])];
  const machineryOther = machinery.includes('other') ? text(data, 'machineryOther', 'Other machinery') : '';

  return {
    fullName: text(data, 'fullName', 'Full name'),
    phoneNumber,
    village: text(data, 'village', 'Village / location'),
    mandalDistrict: text(data, 'mandalDistrict', 'Mandal / district'),
    pincode,
    state,
    machinery,
    machineryOther,
  };
}
