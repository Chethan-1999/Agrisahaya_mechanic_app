/**
 * Lets a technician whose phone or number Firebase has blocked ("too many attempts") log in anyway.
 *
 * Firebase has no API to lift its own SMS abuse block. Instead this adds the number to Firebase Auth's
 * test phone numbers with a one-off code: Firebase then sends no SMS and applies no SMS rate limit to it.
 * Tell the technician the code (phone call, not SMS), let them log in, then REMOVE the entry — while it's
 * there, anyone who knows the number and code can sign in as them. Removing it doesn't log them out: their
 * session stays until they log out.
 *
 * Local only, like create-admin.ts — needs the service account key in functions/.env.scripts.
 *
 * Usage (from the functions/ directory):
 *   npm run otp-bypass -- add 9876543210          # prints a fresh random code
 *   npm run otp-bypass -- add 9876543210 123456   # or choose the code
 *   npm run otp-bypass -- remove 9876543210
 *   npm run otp-bypass -- list
 */
import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import path from 'node:path';

import { config } from 'dotenv';

// NOT functions/.env — see create-admin.ts.
config({ path: path.resolve(__dirname, '../.env.scripts') });

import { applicationDefault } from 'firebase-admin/app';

// The permanent test numbers the team uses (see README) — `remove` leaves these alone.
const PERMANENT_TEST_NUMBERS = new Set(['+919000011101', '+919000011102', '+919000011103']);

function projectId(): string {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS in functions/.env.scripts.');
  return JSON.parse(readFileSync(keyFile, 'utf8')).project_id;
}

async function authConfig(method: 'GET' | 'PATCH', body?: unknown): Promise<{ signIn?: { phoneNumber?: { testPhoneNumbers?: Record<string, string> } } }> {
  const { access_token } = await applicationDefault().getAccessToken();
  const query = method === 'PATCH' ? '?updateMask=signIn.phoneNumber.testPhoneNumbers' : '';
  const response = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId()}/config${query}`, {
    method,
    headers: { authorization: `Bearer ${access_token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Firebase Auth config ${method} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

function toE164(input: string | undefined): string {
  const digits = (input ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) throw new Error(`"${input}" is not a valid 10-digit Indian mobile number.`);
  return `+91${digits}`;
}

async function main() {
  const [command, number, chosenCode] = process.argv.slice(2);
  const current = (await authConfig('GET')).signIn?.phoneNumber?.testPhoneNumbers ?? {};
  const save = (testPhoneNumbers: Record<string, string>) => authConfig('PATCH', { signIn: { phoneNumber: { testPhoneNumbers } } });

  if (command === 'list') {
    for (const [phone, code] of Object.entries(current)) {
      console.log(`${phone}  ${code}${PERMANENT_TEST_NUMBERS.has(phone) ? '  (permanent test number)' : '  <- remove once used'}`);
    }
    return;
  }

  if (command === 'add') {
    const phone = toE164(number);
    const code = chosenCode ?? String(randomInt(100000, 1000000));
    if (!/^\d{6}$/.test(code)) throw new Error('The code must be 6 digits.');
    await save({ ...current, [phone]: code });
    console.log(`${phone} can now log in with code ${code} — no SMS is sent.`);
    console.log(`Remove it once they're in: npm run otp-bypass -- remove ${phone.slice(3)}`);
    return;
  }

  if (command === 'remove') {
    const phone = toE164(number);
    if (PERMANENT_TEST_NUMBERS.has(phone)) throw new Error(`${phone} is a permanent test number; not removing it.`);
    if (!(phone in current)) {
      console.log(`${phone} has no bypass code — nothing to remove.`);
      return;
    }
    const { [phone]: _removed, ...rest } = current;
    await save(rest);
    console.log(`Removed ${phone}. They stay logged in; future logins use a normal SMS code again.`);
    return;
  }

  console.error('Usage: npm run otp-bypass -- add <number> [code] | remove <number> | list');
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
