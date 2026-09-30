import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';

/**
 * Outgoing SMS — a technician's account approval, a farmer's subscription confirmation. The one seam every SMS goes
 * through; the provider is picked by the `SMS_PROVIDER` env var (functions/.env.<project-id> when deployed,
 * functions/.env.local in the emulator):
 *
 * - `none` (default) — nothing is sent; the send is logged and reported `not-configured`, and the admin app offers
 *   "Send SMS from this phone" with the same text.
 * - `sms-gate` — SMS Gateway for Android (https://sms-gate.app): an Android phone running the gateway app, signed in
 *   to its cloud relay, sends the SMS from its own SIM. No DLT registration and no per-message fee beyond the SIM
 *   plan, but that phone must stay on, online, and running the app. Credentials are the ones the app shows under
 *   "Cloud server", stored as the secrets below (functions/.secret.local in the emulator).
 */

export type SmsStatus = 'not-configured' | 'sent' | 'failed';

export type SmsResult = { status: SmsStatus; error?: string };

const smsGateUsername = defineSecret('SMS_GATE_USERNAME');
const smsGatePassword = defineSecret('SMS_GATE_PASSWORD');

/** Pass as `onCall(handler, { secrets: SMS_SECRETS })` on every callable that sends an SMS — v2 functions only see the secrets they declare. */
export const SMS_SECRETS = [smsGateUsername, smsGatePassword];

// The public relay; point SMS_GATE_URL at a self-hosted server ("Private Server" in the app) to use that instead.
const SMS_GATE_DEFAULT_URL = 'https://api.sms-gate.app/3rdparty/v1';
const SEND_TIMEOUT_MS = 10_000;

/**
 * Hands the message to the gateway phone. A 2xx means the relay queued it for the phone (state `Pending`), not that it
 * was delivered — delivery is tracked by the gateway (GET /messages/{id}), not here.
 */
async function sendViaSmsGate(to: string, text: string): Promise<SmsResult> {
  const username = smsGateUsername.value();
  const password = smsGatePassword.value();
  if (!username || !password) {
    logger.error('SMS not sent — SMS_PROVIDER is sms-gate but SMS_GATE_USERNAME/SMS_GATE_PASSWORD are not set', { to });
    return { status: 'failed', error: 'SMS gateway credentials are not configured.' };
  }

  const baseUrl = (process.env.SMS_GATE_URL || SMS_GATE_DEFAULT_URL).replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ textMessage: { text }, phoneNumbers: [to] }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200);
    logger.error('SMS gateway rejected the message', { to, status: response.status, detail });
    return { status: 'failed', error: `SMS gateway returned ${response.status}${detail ? `: ${detail}` : ''}` };
  }

  const { id } = (await response.json().catch(() => ({}))) as { id?: string };
  logger.info('SMS queued on the gateway phone', { to, id });
  return { status: 'sent' };
}

/** Sends `text` to `to` (E.164, +91XXXXXXXXXX). Never throws — a failure comes back as `{ status: 'failed', error }`. */
export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER ?? 'none';

  try {
    switch (provider) {
      case 'none':
        logger.info('SMS not sent — no SMS provider configured (SMS_PROVIDER)', { to, text });
        return { status: 'not-configured' };
      case 'sms-gate':
        return await sendViaSmsGate(to, text);
      default:
        logger.error(`Unknown SMS_PROVIDER "${provider}"`, { to });
        return { status: 'failed', error: `Unknown SMS provider "${provider}".` };
    }
  } catch (error) {
    logger.error('SMS send failed', { to, error });
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}
