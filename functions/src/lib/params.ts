import { defineInt } from 'firebase-functions/params';

/**
 * Lifetime cap on how many profileUpdateRequests a technician may ever
 * submit, counted across every request regardless of outcome. Override per
 * environment via functions/.env (local/emulator) or
 * functions/.env.<project-id> (merged in automatically by `firebase deploy`)
 * — never edit this default for a one-off deploy.
 */
export const PROFILE_UPDATE_LIFETIME_CAP = defineInt('PROFILE_UPDATE_LIFETIME_CAP', { default: 2 });
