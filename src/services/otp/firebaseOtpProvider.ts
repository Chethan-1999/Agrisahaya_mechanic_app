import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

import { auth } from '../../firebase';
import type { OtpProvider } from './types';

const RECAPTCHA_CONTAINER_ID = 'recaptcha-container';

// A RecaptchaVerifier bound to this container from a previous requestOtp
// call (Send OTP clicked more than once — a retry, or switching phone
// numbers). Rendering a second verifier on the same DOM node without
// clearing the first throws "reCAPTCHA has already been rendered in this
// element", so every call below tears down whatever's here first.
let currentVerifier: RecaptchaVerifier | null = null;

/** Real Firebase Phone Auth — real SMS, real reCAPTCHA. This is "the Firebase OTP service" itself; we don't touch OTP generation, delivery, or verification here at all. */
export const firebaseOtpProvider: OtpProvider = {
  async requestOtp(phoneE164) {
    currentVerifier?.clear();
    currentVerifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, { size: 'invisible' });
    const confirmationResult = await signInWithPhoneNumber(auth, phoneE164, currentVerifier);

    return {
      session: {
        async confirm(code) {
          await confirmationResult.confirm(code);
        },
      },
    };
  },
};
