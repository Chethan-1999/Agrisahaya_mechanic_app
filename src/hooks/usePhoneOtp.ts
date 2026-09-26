import { useState } from 'react';

import { auth } from '../firebase';
import { requestOtp } from '../services/auth';
import type { OtpSession } from '../services/otp';
import { authErrorCode } from '../services/otp/otpErrors';
import { isValidPhone, toE164 } from '../utils/validation';

const EXPIRED_CODES = new Set(['auth/code-expired', 'auth/session-expired', 'auth/invalid-verification-id', 'auth/missing-verification-id']);

/** How long one SMS code stays usable in the app — Send OTP within this window reuses it instead of sending another. */
export const OTP_REUSE_MS = 3 * 60 * 1000;

type SentOtp = {
  phoneE164: string;
  session: OtpSession;
  sentAt: number;
  devHint: string | null;
  // Set once the code signs someone in, so the Login and Sign Up tabs don't confirm the same code twice.
  verifiedUid: string | null;
};

// Module-level, not hook state, so the code survives switching between the Login and Sign Up tabs and leaving and
// re-opening the screen. Every extra SMS request also counts towards Firebase's "too many attempts" block.
let lastSent: SentOtp | null = null;

/** The last code sent to this number, if it can still be used: inside the reuse window, and not already spent on a sign-in that has since ended. */
function reusableOtp(phoneE164: string): SentOtp | null {
  if (!lastSent || lastSent.phoneE164 !== phoneE164) return null;
  if (Date.now() - lastSent.sentAt >= OTP_REUSE_MS) return null;
  if (lastSent.verifiedUid && lastSent.verifiedUid !== auth.currentUser?.uid) return null;
  return lastSent;
}

function activeOtp(): SentOtp | null {
  return lastSent && reusableOtp(lastSent.phoneE164);
}

/**
 * Phone-entry + OTP-entry state, shared by the login and signup screens —
 * they differ only in what happens after confirm() resolves, which stays
 * with each caller.
 */
export function usePhoneOtp() {
  const [phoneNumber, setPhoneNumber] = useState(() => activeOtp()?.phoneE164.replace(/^\+91/, '') ?? '');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState<SentOtp | null>(activeOtp);

  /**
   * Returns the devHint directly, since the state this hook set a
   * moment ago isn't visible in the caller's own closure until the next
   * render. `reused` is true when no new SMS was sent because the last
   * code to this number is still valid.
   */
  async function sendOtp(): Promise<{ devHint: string | null; reused: boolean }> {
    if (!isValidPhone(phoneNumber)) {
      throw new Error('INVALID_PHONE');
    }

    const phoneE164 = toE164(phoneNumber);
    const reusable = reusableOtp(phoneE164);
    if (reusable) {
      setSent(reusable);
      return { devHint: reusable.devHint, reused: true };
    }

    const result = await requestOtp(phoneE164);
    lastSent = { phoneE164, session: result.session, sentAt: Date.now(), devHint: result.devHint ?? null, verifiedUid: null };
    setSent(lastSent);
    return { devHint: lastSent.devHint, reused: false };
  }

  async function confirmOtp(): Promise<void> {
    if (!sent) {
      throw new Error('NO_SESSION');
    }

    // Already signed in with this code on the other tab — confirming it again would be rejected.
    if (sent.verifiedUid && sent.verifiedUid === auth.currentUser?.uid) return;

    try {
      await sent.session.confirm(otp);
    } catch (err) {
      // Firebase says this code is finished — let Send OTP get a new one straight away instead of reusing it.
      if (EXPIRED_CODES.has(authErrorCode(err)) && lastSent === sent) lastSent = null;
      throw err;
    }
    sent.verifiedUid = auth.currentUser?.uid ?? null;
  }

  function clearOtpSession() {
    setSent(null);
  }

  return { phoneNumber, setPhoneNumber, otp, setOtp, session: sent?.session ?? null, sentAt: sent?.sentAt ?? null, sendOtp, confirmOtp, clearOtpSession };
}
