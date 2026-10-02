import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';

/**
 * Outgoing SMS — a technician's account approval, a farmer's subscription confirmation. The one seam every SMS goes
 * through; the provider is picked by the `SMS_PROVIDER` env var (functions/.env.<project-id> when deployed,
 * functions/.env.local in the emulator):
 *
 * - `none` (default) — nothing is sent; the send is logged and reported `not-configured`, and the admin app offers
 *   to send the same text from the admin's own phone.
 * - `sms-gate` — SMS Gateway for Android (https://sms-gate.app): an Android phone running the gateway app, signed in
 *   to its cloud relay, sends the SMS from its own SIM. No DLT registration and no per-message fee beyond the SIM
 *   plan, but that phone must stay on, online, and running the app. Credentials are the ones the app shows under
 *   "Cloud server", stored as the secrets below (functions/.secret.local in the emulator).
 *
 * Nothing is retried here: the outcome goes back to the caller, whose `error` is a short statement of the problem
 * for the admin to read (the full detail is logged). Farmer confirmations record it on the request
 * (farmerSubscriptionFunctions.ts); the admin can then send the same text from their own phone.
 */

/**
 * - `sent` — the gateway phone took the message (it may still be on its way to the recipient).
 * - `queued` — the relay accepted it but the gateway phone never picked it up: the phone is off, offline, or the app
 *   stopped. The relay keeps it and the phone sends it once it reconnects.
 * - `failed` — it was not accepted, or the gateway phone tried and failed (no balance, no signal, ...).
 */
export type SmsStatus = 'not-configured' | 'sent' | 'queued' | 'failed';

export type SmsResult = { status: SmsStatus; error?: string };

/** What a callable that sent an SMS hands back, so the admin app can show a failure and offer its own Messages app. */
export type SmsOutcome = SmsResult & { phoneNumber: string; message: string };

const smsGateUsername = defineSecret('SMS_GATE_USERNAME');
const smsGatePassword = defineSecret('SMS_GATE_PASSWORD');

/** Pass as `onCall(handler, { secrets: SMS_SECRETS })` on every callable that sends an SMS — v2 functions only see the secrets they declare. */
export const SMS_SECRETS = [smsGateUsername, smsGatePassword];

// The public relay; point SMS_GATE_URL at a self-hosted server ("Private Server" in the app) to use that instead.
const SMS_GATE_DEFAULT_URL = 'https://api.sms-gate.app/3rdparty/v1';
const SEND_TIMEOUT_MS = 10_000;
// How long to wait for the gateway phone to pick a message up before calling it offline. A healthy phone takes a
// second or two (the relay wakes it with a push); the admin waits on this, so keep it short.
const PICKUP_WAIT_MS = 8_000;
const PICKUP_POLL_MS = 1_500;

// What the admin reads when an SMS didn't go out — the problem only, short enough for a card or a push.
const ERRORS = {
  notConfigured: 'SMS service is not set up.',
  credentials: 'SMS Gateway login failed.',
  unreachable: 'SMS Gateway service is unreachable.',
  offline: 'SMS Gateway phone is offline.',
  phoneFailed: 'SMS Gateway phone could not send it.',
};

type GateMessage = { id?: string; state?: string; recipients?: Array<{ state?: string; error?: string | null }> };

function gateAuth() {
  const username = smsGateUsername.value();
  const password = smsGatePassword.value();
  return username && password ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` : null;
}

const gateBaseUrl = () => (process.env.SMS_GATE_URL || SMS_GATE_DEFAULT_URL).replace(/\/+$/, '');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls the message on the relay until the gateway phone has picked it up (`Processed`/`Sent`/`Delivered`), it has
 * failed, or PICKUP_WAIT_MS runs out — returning the last state seen, `Pending` meaning the phone never showed up.
 */
async function waitForPickup(auth: string, message: GateMessage): Promise<GateMessage> {
  const deadline = Date.now() + PICKUP_WAIT_MS;
  let current = message;

  while (current.state === 'Pending' && current.id && Date.now() < deadline) {
    await sleep(PICKUP_POLL_MS);
    try {
      const response = await fetch(`${gateBaseUrl()}/messages/${encodeURIComponent(current.id)}`, {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (response.ok) current = (await response.json()) as GateMessage;
    } catch (error) {
      logger.warn('Could not check SMS state on the gateway', { id: current.id, error });
    }
  }

  return current;
}

/** Hands the message to the gateway phone through the relay and waits briefly to see that the phone picks it up. */
async function sendViaSmsGate(to: string, text: string): Promise<SmsResult> {
  const auth = gateAuth();
  if (!auth) {
    logger.error('SMS not sent — SMS_PROVIDER is sms-gate but SMS_GATE_USERNAME/SMS_GATE_PASSWORD are not set', { to });
    return { status: 'failed', error: ERRORS.credentials };
  }

  let response: Response;
  try {
    response = await fetch(`${gateBaseUrl()}/messages`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ textMessage: { text }, phoneNumbers: [to] }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (error) {
    logger.error('SMS gateway unreachable', { to, error });
    return { status: 'failed', error: ERRORS.unreachable };
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200);
    logger.error('SMS gateway rejected the message', { to, status: response.status, detail });
    return { status: 'failed', error: response.status === 401 || response.status === 403 ? ERRORS.credentials : ERRORS.unreachable };
  }

  const queued = (await response.json().catch(() => ({}))) as GateMessage;
  const message = await waitForPickup(auth, { state: 'Pending', ...queued });

  if (message.state === 'Failed') {
    const error = message.recipients?.find((recipient) => recipient.error)?.error;
    logger.error('SMS failed on the gateway phone', { to, id: message.id, error });
    return { status: 'failed', error: ERRORS.phoneFailed };
  }

  if (message.state === 'Pending') {
    logger.warn('SMS waiting on the relay — the gateway phone did not pick it up; it is probably offline', { to, id: message.id });
    return { status: 'queued', error: ERRORS.offline };
  }

  logger.info('SMS picked up by the gateway phone', { to, id: message.id, state: message.state });
  return { status: 'sent' };
}

/** Sends `text` to `to` (E.164, +91XXXXXXXXXX). Never throws — a failure comes back as `{ status: 'failed', error }`. */
export async function sendSms(to: string, text: string): Promise<SmsOutcome> {
  const provider = process.env.SMS_PROVIDER ?? 'none';
  const outcome = (result: SmsResult): SmsOutcome => ({ ...result, phoneNumber: to, message: text });

  try {
    switch (provider) {
      case 'none':
        logger.info('SMS not sent — no SMS provider configured (SMS_PROVIDER)', { to, text });
        return outcome({ status: 'not-configured', error: ERRORS.notConfigured });
      case 'sms-gate':
        return outcome(await sendViaSmsGate(to, text));
      default:
        logger.error(`Unknown SMS_PROVIDER "${provider}"`, { to });
        return outcome({ status: 'failed', error: ERRORS.notConfigured });
    }
  } catch (error) {
    logger.error('SMS send failed', { to, error });
    return outcome({ status: 'failed', error: ERRORS.unreachable });
  }
}
