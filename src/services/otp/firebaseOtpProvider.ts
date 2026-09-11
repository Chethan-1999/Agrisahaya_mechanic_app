import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

import { auth } from '../../firebase';
import type { OtpProvider } from './types';

const RECAPTCHA_CONTAINER_ID = 'recaptcha-container';

/** Real Firebase Phone Auth — real SMS, real reCAPTCHA. This is "the Firebase OTP service" itself; we don't touch OTP generation, delivery, or verification here at all. */
export const firebaseOtpProvider: OtpProvider = {
  async requestOtp(phoneE164) {
    const verifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, { size: 'invisible' });
    const confirmationResult = await signInWithPhoneNumber(auth, phoneE164, verifier);

    return {
      session: {
        async confirm(code) {
          await confirmationResult.confirm(code);
        },
      },
    };
  },
};
