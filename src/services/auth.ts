import { httpsCallable } from 'firebase/functions';

import { functions } from '../firebase';
import { activeOtpProvider, type OtpRequestResult } from './otp';
import type { MechanicForm } from '../types';

/** Starts phone verification — real SMS in production, a throwaway local code in dev. See services/otp/. */
export async function requestOtp(phoneE164: string): Promise<OtpRequestResult> {
  return activeOtpProvider.requestOtp(phoneE164);
}

const completeSignupFn = httpsCallable<{ profile: Omit<MechanicForm, 'phoneNumber'> }, { status: string }>(
  functions,
  'completeSignup',
);

/** Creates the technician record. Only callable once phone verification has already signed the caller in. */
export async function completeSignup(profile: Omit<MechanicForm, 'phoneNumber'>): Promise<void> {
  await completeSignupFn({ profile });
}
