/**
 * The farmer-facing SMS wording, in one place (push wording lives in notifications.ts). Kept free of emoji and other
 * non-GSM characters so each message costs as few SMS parts as possible.
 */

export const PLAN_NAME = 'AgriSahaya Annual Service Plan';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-30" → "30 Sep 2026". */
export function formatPlanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** "Ramesh Kumar Gowda" → "Ramesh" — an SMS greets by first name, like the technician's approval SMS. */
const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] || 'there';

/**
 * The farmer's subscription confirmation, sent through lib/sms.ts when an admin approves the request (and again by
 * "Resend SMS", which rebuilds it from this template). Plain GSM text, about 330 characters — three SMS parts.
 */
export const subscriptionConfirmed = (plan: {
  farmerName: string;
  startDate: string;
  endDate: string;
  supportPhoneNumber: string;
}) => [
  `AgriSahaya: Namaste ${firstName(plan.farmerName)}! Welcome to the AgriSahaya family - we are excited to serve you.`,
  `Your ${PLAN_NAME} is now ACTIVE from ${formatPlanDate(plan.startDate)} to ${formatPlanDate(plan.endDate)}.`,
  'You get: on-call support for your farm machines, technician visits at your farm (repair costs paid by you), ' +
    'genuine spare parts and regular maintenance reminders.',
  `Need help? Call ${plan.supportPhoneNumber}`,
].join('\n');
