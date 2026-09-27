import { HttpsError } from 'firebase-functions/v2/https';

/** A required, non-empty string field of a callable's `request.data`, or an invalid-argument error. */
export function requireString(data: unknown, field: string, message = `${field} is required.`): string {
  const value = (data as Record<string, unknown> | null | undefined)?.[field];

  if (typeof value !== 'string' || !value) {
    throw new HttpsError('invalid-argument', message);
  }

  return value;
}

/** Trimmed text, or null when the value is missing, not text, or only whitespace. */
export const optionalTrimmed = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
