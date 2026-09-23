import type { MechanicForm } from '../types';

/**
 * Signup details kept on the phone (never the phone number itself — that comes from the OTP step), so a failed
 * or abandoned signup, or a re-application after a rejection, doesn't mean typing everything again.
 */
export type ProfileDraft = Omit<MechanicForm, 'phoneNumber'>;

const signupKey = 'agrisahaya.signupDraft';
const reapplyKey = (technicianId: string) => `agrisahaya.reapplyDraft.${technicianId}`;

function read(key: string): ProfileDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ProfileDraft) : null;
  } catch {
    return null; // blocked storage or a corrupt entry — start from an empty form
  }
}

function write(key: string, draft: ProfileDraft): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts — the draft just isn't kept.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // nothing to clean up if storage is blocked
  }
}

export const loadSignupDraft = () => read(signupKey);
export const saveSignupDraft = (draft: ProfileDraft) => write(signupKey, draft);
export const clearSignupDraft = () => remove(signupKey);

export const loadReapplyDraft = (technicianId: string) => read(reapplyKey(technicianId));
export const saveReapplyDraft = (technicianId: string, draft: ProfileDraft) => write(reapplyKey(technicianId), draft);
export const clearReapplyDraft = (technicianId: string) => remove(reapplyKey(technicianId));
