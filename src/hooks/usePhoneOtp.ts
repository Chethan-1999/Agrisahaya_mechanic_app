import { useState } from 'react';

import { getSettings } from '../config/settings';
import { auth } from '../firebase';
import { requestOtp } from '../services/auth';
import type { OtpSession } from '../services/otp';
import { authErrorCode } from '../services/otp/otpErrors';
import { isValidPhone, toE164 } from '../utils/validation';

const EXPIRED_CODES = new Set(['auth/code-expired', 'auth/session-expired', 'auth/invalid-verification-id', 'auth/missing-verification-id']);

const HOUR_MS = 60 * 60 * 1000;
const SEND_LOG_KEY = 'otpSendLog';

/** How long one SMS code stays usable in the app — Send OTP within this window reuses it instead of sending another. */
const reuseMs = () => getSettings().otpReuseSeconds * 1000;

/**
 * The app's own OTP limits (settings otpMaxSendsPerHour / otpMaxWrongCodes), which keep technicians from running into
 * Firebase's much longer "too many attempts" block. `retryAt` is when a new code may be requested again.
 */
export class OtpLimitError extends Error {
  constructor(readonly limit: 'sends-per-hour' | 'wrong-codes', readonly retryAt?: number) {
    super(limit);
  }
}

type SentOtp = {
  phoneE164: string;
  session: OtpSession;
  sentAt: number;
  devHint: string | null;
  // Set once the code signs someone in, so the Login and Sign Up tabs don't confirm the same code twice.
  verifiedUid: string | null;
  wrongCodes: number;
};

// Module-level, not hook state, so the code survives switching between the Login and Sign Up tabs and leaving and
// re-opening the screen. Every extra SMS request also counts towards Firebase's "too many attempts" block.
let lastSent: SentOtp | null = null;

/** The last code sent to this number, if it can still be used: inside the reuse window, and not already spent on a sign-in that has since ended. */
function reusableOtp(phoneE164: string): SentOtp | null {
  if (!lastSent || lastSent.phoneE164 !== phoneE164) return null;
  if (Date.now() - lastSent.sentAt >= reuseMs()) return null;
  if (lastSent.verifiedUid && lastSent.verifiedUid !== auth.currentUser?.uid) return null;
  return lastSent;
}

function activeOtp(): SentOtp | null {
  return lastSent && reusableOtp(lastSent.phoneE164);
}

// When each number was last sent a new code from this phone, kept across app restarts. Browser storage can be
// unavailable (private mode, blocked site data) — the limit then just doesn't apply.
function sendsInLastHour(phoneE164: string): number[] {
  try {
    const log = JSON.parse(window.localStorage.getItem(SEND_LOG_KEY) ?? '{}') as Record<string, number[]>;
    return (log[phoneE164] ?? []).filter((at) => Date.now() - at < HOUR_MS);
  } catch {
    return [];
  }
}

function recordSend(phoneE164: string): void {
  try {
    const log = JSON.parse(window.localStorage.getItem(SEND_LOG_KEY) ?? '{}') as Record<string, number[]>;
    log[phoneE164] = [...sendsInLastHour(phoneE164), Date.now()];
    window.localStorage.setItem(SEND_LOG_KEY, JSON.stringify(log));
  } catch {
    // Best-effort only.
  }
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

    const recentSends = sendsInLastHour(phoneE164);
    if (recentSends.length >= getSettings().otpMaxSendsPerHour) {
      throw new OtpLimitError('sends-per-hour', Math.min(...recentSends) + HOUR_MS);
    }

    const result = await requestOtp(phoneE164);
    recordSend(phoneE164);
    lastSent = { phoneE164, session: result.session, sentAt: Date.now(), devHint: result.devHint ?? null, verifiedUid: null, wrongCodes: 0 };
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
      const code = authErrorCode(err);
      const tooManyWrong = code === 'auth/invalid-verification-code' && ++sent.wrongCodes >= getSettings().otpMaxWrongCodes;

      // This code is finished (expired, or too many wrong tries) — Send OTP gets a new one instead of reusing it.
      if (EXPIRED_CODES.has(code) || tooManyWrong) {
        if (lastSent === sent) lastSent = null;
        setSent(null);
      }
      throw tooManyWrong ? new OtpLimitError('wrong-codes') : err;
    }
    sent.verifiedUid = auth.currentUser?.uid ?? null;
  }

  function clearOtpSession() {
    setSent(null);
  }

  const expiresAt = sent ? sent.sentAt + reuseMs() : null;

  return { phoneNumber, setPhoneNumber, otp, setOtp, session: sent?.session ?? null, expiresAt, sendOtp, confirmOtp, clearOtpSession };
}
