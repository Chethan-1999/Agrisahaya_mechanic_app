import type { StringKey } from '../../i18n/strings';

// Firebase Auth error codes a technician can hit while requesting or confirming an OTP, mapped to a
// translated message. Anything unrecognised falls back to a generic "try again" rather than showing
// the raw "Firebase: ... (auth/...)" text.
const OTP_ERROR_KEYS: Record<string, StringKey> = {
  // Phone sign-in disabled, or the SMS region policy blocks the number's country (Firebase console →
  // Authentication → Settings → SMS region policy). Only the project owner can fix this.
  'auth/operation-not-allowed': 'otpSmsUnavailable',
  'auth/too-many-requests': 'otpTooManyAttempts',
  'auth/too-many-requests (device blocked)': 'otpTooManyAttempts',
  // Firebase's "unusual activity" block on a number/device after many requests — same advice: wait.
  'auth/error-code:-39': 'otpTooManyAttempts',
  'auth/quota-exceeded': 'otpTooManyAttempts',
  'auth/invalid-phone-number': 'enterValidPhone',
  'auth/missing-phone-number': 'enterValidPhone',
  'auth/invalid-verification-code': 'otpWrongCode',
  'auth/missing-verification-code': 'otpWrongCode',
  'auth/code-expired': 'otpCodeExpired',
  'auth/session-expired': 'otpCodeExpired',
  'auth/invalid-verification-id': 'otpCodeExpired',
  'auth/missing-verification-id': 'otpCodeExpired',
  // The reCAPTCHA answer was rejected (e.g. an image puzzle left open until it expired).
  'auth/captcha-check-failed': 'otpCheckFailed',
  'auth/invalid-app-credential': 'otpCheckFailed',
  'auth/missing-app-credential': 'otpCheckFailed',
  'auth/network-request-failed': 'networkError',
  // The sign-in itself has ended (e.g. signed in on another phone) — outside the OTP screen too.
  'auth/user-token-expired': 'sessionExpiredError',
  'auth/invalid-user-token': 'sessionExpiredError',
  'auth/id-token-expired': 'sessionExpiredError',
  'auth/requires-recent-login': 'sessionExpiredError',
};

export function authErrorCode(err: unknown): string {
  return typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
}

/** The translated message for an OTP failure, or null when `err` isn't a Firebase Auth error (e.g. our own timeouts). */
export function otpErrorKey(err: unknown): StringKey | null {
  const code = authErrorCode(err);

  if (!code.startsWith('auth/')) return null;

  return OTP_ERROR_KEYS[code] ?? 'otpGenericError';
}
