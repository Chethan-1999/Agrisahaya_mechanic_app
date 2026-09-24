import { onCall as onCallV2, type CallableRequest } from 'firebase-functions/v2/https';

/**
 * Where every callable runs. asia-south1 (Mumbai) sits next to the Firestore database and the users — in us-central1
 * every transaction read/write crossed the world. us-central1 stays deployed only so phones on an older APK (which
 * call us-central1) keep working: drop it once every phone runs a build whose `getFunctions` region is asia-south1
 * (src/firebase.ts). `setGlobalOptions` can't take a list of regions, hence this wrapper.
 */
const REGIONS = ['asia-south1', 'us-central1'];

/** `onCall` from firebase-functions/v2/https, deployed to REGIONS. Use this for every callable. */
export function onCall<Return>(handler: (request: CallableRequest) => Return) {
  return onCallV2({ region: REGIONS }, handler);
}
