import { HttpsError } from 'firebase-functions/v2/https';

import { isIndianState } from '../shared/indianStates';
import type { Settings } from '../shared/settings';

/**
 * A technician's profile fields — everything except the phone number, which only phone sign-in sets. Mirrors
 * MechanicForm (src/types.ts) minus phoneNumber; the technician's own edits and the admin's edits are both limited to
 * these. Everything else on the record (status, paymentVerified, phoneNumber, jobStats, ...) is set only by the
 * function that owns it — never through a profile edit.
 */
export const PROFILE_FIELDS = ['fullName', 'village', 'district', 'state', 'pincode', 'address', 'landmark', 'machineExpertise', 'experience'] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

export const isProfileField = (field: string): field is ProfileField => (PROFILE_FIELDS as readonly string[]).includes(field);

/**
 * A profile-edit callable's `profile` argument as `field -> trimmed value`. Any key that isn't a profile field is
 * refused by name rather than silently dropped, so a client can't mistake an ignored `paymentVerified` for a saved one.
 */
export function parseProfileUpdates(raw: unknown): Partial<Record<ProfileField, string>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HttpsError('invalid-argument', 'profile is required.');
  }

  const updates: Partial<Record<ProfileField, string>> = {};

  for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isProfileField(field)) {
      throw new HttpsError('permission-denied', `"${field}" can't be edited here.`);
    }
    if (typeof value !== 'string') {
      throw new HttpsError('invalid-argument', `"${field}" must be text.`);
    }
    updates[field] = value.trim();
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpsError('invalid-argument', 'No changes were provided.');
  }

  return updates;
}

export type ProfileInput = {
  fullName: string;
  village: string;
  district: string;
  state: string;
  pincode?: string;
  address?: string;
  landmark?: string;
  machineExpertise: string;
  experience: string;
};

/** Server-side mirror of the client's form checks — never trust the client alone. Limits come from the business settings. */
export function assertValidProfile(
  profile: ProfileInput,
  { maxExperienceYears }: Settings,
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

  if (!profile.machineExpertise?.trim()) {
    throw new Error('Machine expertise is required.');
  }

  const experience = Number(profile.experience);
  if (!Number.isFinite(experience) || experience < 0 || experience > maxExperienceYears) {
    throw new Error(`Experience must be between 0 and ${maxExperienceYears} years.`);
  }
}

/** assertValidProfile for a callable: the failure becomes an invalid-argument error the client can show as-is. */
export function requireValidProfile(profile: ProfileInput, settings: Settings): void {
  try {
    assertValidProfile(profile, settings);
  } catch (err) {
    throw new HttpsError('invalid-argument', err instanceof Error ? err.message : 'Invalid profile.');
  }
}

/** A callable's `profile` argument, validated and normalised into the fields stored on the technician record. */
export function parseProfile(raw: unknown, settings: Settings) {
  if (!raw || typeof raw !== 'object') {
    throw new HttpsError('invalid-argument', 'Profile is required.');
  }

  const profile = raw as ProfileInput;
  requireValidProfile(profile, settings);

  return {
    fullName: profile.fullName.trim(),
    village: profile.village.trim(),
    district: profile.district.trim(),
    state: (profile.state ?? '').trim(),
    pincode: (profile.pincode ?? '').trim(),
    address: (profile.address ?? '').trim(),
    landmark: (profile.landmark ?? '').trim() || null,
    machineExpertise: String(profile.machineExpertise).trim(),
    experience: String(profile.experience).trim(),
  };
}
