import type { ConfirmDialog } from '../components/ui';
import type { SmsOutcome } from '../types';

/** An `sms:` link that opens this phone's Messages app with the recipient and text filled in. */
export const smsLink = ({ phoneNumber, message }: Pick<SmsOutcome, 'phoneNumber' | 'message'>) =>
  `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;

/** When a server SMS didn't go out: a dialog stating the problem, with "Open Messages" to send the same text from this phone. */
export function smsFallbackDialog(sms: SmsOutcome | null, recipient: string): ConfirmDialog {
  if (!sms || sms.status === 'sent') return null;

  return {
    title: 'SMS not sent',
    message: `SMS to ${recipient} (${sms.phoneNumber}) not sent: ${sms.error ?? 'unknown problem.'}`,
    confirmLabel: 'Open Messages',
    cancelLabel: 'Close',
    kind: 'primary',
    onConfirm: () => { window.location.href = smsLink(sms); },
  };
}
