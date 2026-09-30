import { logger } from 'firebase-functions/v2';

/**
 * Outgoing SMS to people who don't use the app (today: a farmer's subscription confirmation). The provider isn't chosen
 * yet, so this is the one seam to plug it into: add a case for it below, selected by the `SMS_PROVIDER` env var
 * (functions/.env.<project-id> when deployed). Until then every send is logged and reported `not-configured`, and the
 * admin app offers "Send SMS from this phone" with the same text.
 */

export type SmsStatus = 'not-configured' | 'sent' | 'failed';

export type SmsResult = { status: SmsStatus; error?: string };

/** Sends `text` to `to` (E.164, +91XXXXXXXXXX). Never throws — a failure comes back as `{ status: 'failed', error }`. */
export async function sendSms(to: string, text: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER ?? 'none';

  try {
    switch (provider) {
      case 'none':
        logger.info('SMS not sent — no SMS provider configured (SMS_PROVIDER)', { to, text });
        return { status: 'not-configured' };
      default:
        logger.error(`Unknown SMS_PROVIDER "${provider}"`, { to });
        return { status: 'failed', error: `Unknown SMS provider "${provider}".` };
    }
  } catch (error) {
    logger.error('SMS send failed', { to, error });
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}
