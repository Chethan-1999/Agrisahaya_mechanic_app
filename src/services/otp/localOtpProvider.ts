import { signInWithCustomToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import { auth, functions } from '../../firebase';
import type { OtpProvider } from './types';

const devSignInFn = httpsCallable<{ phone: string }, { customToken: string }>(functions, 'devSignIn');

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Local-dev stand-in — no real SMS, no reCAPTCHA. Generates its own code and
 * hands it back as `devHint` so the UI can show it directly; confirming it
 * calls the emulator-only `devSignIn` function to actually establish the
 * Firebase Auth session. Selected automatically whenever the app is pointed
 * at the local Emulator Suite — see ./index.ts.
 */
export const localOtpProvider: OtpProvider = {
  async requestOtp(phoneE164) {
    const code = generateSixDigitCode();

    return {
      devHint: code,
      session: {
        async confirm(enteredCode) {
          if (enteredCode.trim() !== code) {
            throw Object.assign(new Error('Incorrect code.'), { code: 'auth/invalid-verification-code' });
          }

          const result = await devSignInFn({ phone: phoneE164 });
          await signInWithCustomToken(auth, result.data.customToken);
        },
      },
    };
  },
};
