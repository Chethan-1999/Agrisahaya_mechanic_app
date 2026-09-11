import { useState } from 'react';

import { requestOtp } from '../services/auth';
import type { OtpSession } from '../services/otp';
import { isValidPhone, toE164 } from '../utils/validation';

/**
 * Phone-entry + OTP-entry state, shared by the login and signup screens —
 * they differ only in what happens after confirm() resolves, which stays
 * with each caller.
 */
export function usePhoneOtp() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [session, setSession] = useState<OtpSession | null>(null);
  const [devHint, setDevHint] = useState<string | null>(null);

  async function sendOtp(): Promise<void> {
    if (!isValidPhone(phoneNumber)) {
      throw new Error('INVALID_PHONE');
    }

    const result = await requestOtp(toE164(phoneNumber));
    setSession(result.session);
    setDevHint(result.devHint ?? null);
  }

  async function confirmOtp(): Promise<void> {
    if (!session) {
      throw new Error('NO_SESSION');
    }

    await session.confirm(otp);
  }

  return { phoneNumber, setPhoneNumber, otp, setOtp, session, devHint, sendOtp, confirmOtp };
}
