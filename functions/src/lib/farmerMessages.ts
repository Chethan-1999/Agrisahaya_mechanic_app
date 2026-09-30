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

export const subscriptionConfirmed = (plan: {
  farmerName: string;
  months: number;
  startDate: string;
  endDate: string;
  supportPhoneNumber: string;
}) => [
  `Welcome to the AgriSahaya family, ${plan.farmerName}! We're excited to have you with us.`,
  `Your ${PLAN_NAME} is now ACTIVE.`,
  `Duration: ${plan.months} months (${formatPlanDate(plan.startDate)} to ${formatPlanDate(plan.endDate)})`,
  'Your plan covers:',
  '- On-call support for your farm machinery',
  '- Technician visits at your farm (service/repair costs are paid directly by you)',
  '- Access to genuine spare parts',
  '- Regular maintenance reminders',
  `We look forward to keeping your machines running. Need help? Call ${plan.supportPhoneNumber}.`,
  '- Team AgriSahaya',
].join('\n');
