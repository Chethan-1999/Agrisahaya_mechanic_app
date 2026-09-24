import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import type { PluginListenerHandle } from '@capacitor/core';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';

import { auth } from '../../firebase';
import type { OtpProvider } from './types';

// The native plugin only reports a failure's message, not Firebase's error code. Map the Android SDK's
// known messages back to the codes otpErrors.ts already translates; anything else keeps its message.
const NATIVE_ERROR_CODES: Array<[RegExp, string]> = [
  [/blocked all requests|unusual activity/i, 'auth/too-many-requests (device blocked)'],
  [/too many/i, 'auth/too-many-requests'],
  [/quota/i, 'auth/quota-exceeded'],
  [/region|not allowed|operation is not allowed/i, 'auth/operation-not-allowed'],
  [/format of the phone number|invalid phone/i, 'auth/invalid-phone-number'],
  [/network/i, 'auth/network-request-failed'],
  [/app identifier|play integrity|safetynet|recaptcha|app verification|app check/i, 'auth/invalid-app-credential'],
];

function nativeAuthError(message: string): Error & { code: string } {
  const code = NATIVE_ERROR_CODES.find(([pattern]) => pattern.test(message))?.[1] ?? `auth/native: ${message.slice(0, 80)}`;
  return Object.assign(new Error(message), { code });
}

/**
 * Real Firebase Phone Auth on Android, through the native SDK instead of the WebView. The native SDK proves
 * the request comes from this app with Play Integrity (using the SHA fingerprints registered on the Firebase
 * Android app), so there's no web reCAPTCHA — which, inside the WebView, kept showing image puzzles and then
 * got rejected for real numbers.
 *
 * `skipNativeAuth` is on (capacitor.config.ts): the native side only sends the SMS and hands back a
 * verificationId; the JS SDK signs in with it, so the session the rest of the app uses (auth.currentUser,
 * callable functions, revokeOtherSessions) is exactly the same as before.
 */
export const nativeOtpProvider: OtpProvider = {
  async requestOtp(phoneE164) {
    const handles: PluginListenerHandle[] = [];

    try {
      const verificationId = await new Promise<string>((resolve, reject) => {
        void (async () => {
          handles.push(await FirebaseAuthentication.addListener('phoneCodeSent', (event) => resolve(event.verificationId)));
          handles.push(await FirebaseAuthentication.addListener('phoneVerificationFailed', (event) => reject(nativeAuthError(event.message))));
          // Android can occasionally verify a number without an SMS ("instant verification"), which gives no
          // verificationId for the JS SDK to sign in with — treat it as a retry rather than hang.
          handles.push(await FirebaseAuthentication.addListener('phoneVerificationCompleted', () =>
            reject(nativeAuthError('Instant verification is not supported here; please try again.'))));
          // timeout 0 turns off SMS auto-retrieval: the technician always types the code, same as before.
          await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: phoneE164, timeout: 0 });
        })().catch(reject);
      });

      return {
        session: {
          async confirm(code) {
            await signInWithCredential(auth, PhoneAuthProvider.credential(verificationId, code.trim()));
          },
        },
      };
    } finally {
      await Promise.all(handles.map((handle) => handle.remove()));
    }
  },
};
