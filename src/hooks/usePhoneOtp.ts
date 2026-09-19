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

  /**
   * Returns the fresh devHint directly, since the state this hook set a
   * moment ago isn't visible in the caller's own closure until the next
   * render — reading a hook-returned state value right after the call that
   * set it shows the *previous* send's code, which no longer matches the
   * session this call just created.
   */
  async function sendOtp(): Promise<string | null> {
    if (!isValidPhone(phoneNumber)) {
      throw new Error('INVALID_PHONE');
    }

    const result = await requestOtp(toE164(phoneNumber));
    setSession(result.session);
    return result.devHint ?? null;
  }

  async function confirmOtp(): Promise<void> {
    if (!session) {
      throw new Error('NO_SESSION');
    }

    await session.confirm(otp);
  }

  function clearOtpSession() {
    setSession(null);
  }

  return { phoneNumber, setPhoneNumber, otp, setOtp, session, sendOtp, confirmOtp, clearOtpSession };
}
