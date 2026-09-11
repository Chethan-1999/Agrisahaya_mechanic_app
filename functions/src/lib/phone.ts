/** Normalizes a raw 10-digit Indian mobile number to E.164 ("+91XXXXXXXXXX"). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const last10 = digits.slice(-10);

  if (!/^[6-9]\d{9}$/.test(last10)) {
    throw new Error('invalid-phone');
  }

  return `+91${last10}`;
}
