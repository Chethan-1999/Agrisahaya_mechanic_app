import type { DecodedIdToken } from 'firebase-admin/auth';
import { onCall as onCallV2, type CallableOptions, type CallableRequest } from 'firebase-functions/v2/https';

/**
 * Where every callable runs. asia-south1 (Mumbai) sits next to the Firestore database and the users — in us-central1
 * every transaction read/write crossed the world. us-central1 stays deployed only so phones on an older APK (which
 * call us-central1) keep working: drop it once every phone runs a build whose `getFunctions` region is asia-south1
 * (src/firebase.ts). `setGlobalOptions` can't take a list of regions, hence this wrapper.
 */
const REGIONS = ['asia-south1', 'us-central1'];

/**
 * Local testing only: a request carrying `X-Local-Auth: <LOCAL_AUTH_TOKEN>` is treated as signed in — as
 * `X-Local-Uid` if given, else LOCAL_AUTH_UID — so a function can be called with curl (`make call`) without a real
 * sign-in. Add `X-Local-Phone` to act as a phone-verified user (completeSignup needs it).
 *
 * Inert outside the emulator, twice over: FUNCTIONS_EMULATOR is only set by `firebase emulators:start` (the same guard
 * devSignIn uses), and LOCAL_AUTH_TOKEN lives in functions/.env.local, which only the emulator loads — deploys never do.
 */
function withLocalAuth(request: CallableRequest): CallableRequest {
  const token = process.env.LOCAL_AUTH_TOKEN;
  if (process.env.FUNCTIONS_EMULATOR !== 'true' || !token || request.rawRequest.header('x-local-auth') !== token) return request;

  const uid = request.rawRequest.header('x-local-uid') || process.env.LOCAL_AUTH_UID;
  if (!uid) return request;

  const now = Math.floor(Date.now() / 1000);
  const phone = request.rawRequest.header('x-local-phone');
  const claims = {
    uid, sub: uid, aud: process.env.GCLOUD_PROJECT, iss: 'local-auth', iat: now, exp: now + 3600, auth_time: now,
    ...(phone ? { phone_number: phone } : {}),
    firebase: { identities: {}, sign_in_provider: 'custom' },
  } as DecodedIdToken;

  return { ...request, auth: { uid, token: claims } };
}

/**
 * `onCall` from firebase-functions/v2/https, deployed to REGIONS. Use this for every callable. `options.secrets` lists
 * the Secret Manager secrets the handler reads (e.g. lib/sms.ts's SMS_SECRETS).
 */
export function onCall<Return>(handler: (request: CallableRequest) => Return, options: Pick<CallableOptions, 'secrets'> = {}) {
  return onCallV2({ ...options, region: REGIONS }, (request) => handler(withLocalAuth(request)));
}
