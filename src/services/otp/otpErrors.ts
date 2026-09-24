import type { StringKey } from '../../i18n/strings';

// Firebase Auth error codes a technician can hit while requesting or confirming an OTP, mapped to a
// translated message. Anything unrecognised falls back to a generic "try again" rather than showing
// the raw "Firebase: ... (auth/...)" text.
const OTP_ERROR_KEYS: Record<string, StringKey> = {
  // Phone sign-in disabled, or the SMS region policy blocks the number's country (Firebase console →
  // Authentication → Settings → SMS region policy). Only the project owner can fix this.
  'auth/operation-not-allowed': 'otpSmsUnavailable',
  'auth/too-many-requests': 'otpTooManyAttempts',
  'auth/quota-exceeded': 'otpTooManyAttempts',
  'auth/invalid-phone-number': 'enterValidPhone',
  'auth/missing-phone-number': 'enterValidPhone',
  'auth/invalid-verification-code': 'otpWrongCode',
  'auth/missing-verification-code': 'otpWrongCode',
  'auth/code-expired': 'otpCodeExpired',
  'auth/session-expired': 'otpCodeExpired',
  'auth/network-request-failed': 'networkError',
};

/** The translated message for an OTP failure, or null when `err` isn't a Firebase Auth error (e.g. our own timeouts). */
export function otpErrorKey(err: unknown): StringKey | null {
  const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';

  if (!code.startsWith('auth/')) return null;

  return OTP_ERROR_KEYS[code] ?? 'otpGenericError';
}
