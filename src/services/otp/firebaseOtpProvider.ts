import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

import { auth } from '../../firebase';
import type { OtpProvider } from './types';

const RECAPTCHA_CONTAINER_ID = 'recaptcha-container';

// A RecaptchaVerifier from a previous requestOtp call (Send OTP clicked more
// than once — a retry, or switching phone numbers). reCAPTCHA refuses to render
// twice into the same element ("reCAPTCHA has already been rendered in this
// element"), and verifier.clear() doesn't reliably reset it after a failed
// attempt — so every call tears the old one down AND renders into a brand-new
// child element of the container.
let currentVerifier: RecaptchaVerifier | null = null;

function freshRecaptchaElement(): HTMLElement {
  try {
    currentVerifier?.clear();
  } catch {
    // Already torn down — nothing to clear.
  }
  currentVerifier = null;

  const container = document.getElementById(RECAPTCHA_CONTAINER_ID);
  if (!container) throw new Error(`#${RECAPTCHA_CONTAINER_ID} is missing from the page.`);

  const element = document.createElement('div');
  container.replaceChildren(element);
  return element;
}

/** Real Firebase Phone Auth — real SMS, real reCAPTCHA. This is "the Firebase OTP service" itself; we don't touch OTP generation, delivery, or verification here at all. */
export const firebaseOtpProvider: OtpProvider = {
  async requestOtp(phoneE164) {
    currentVerifier = new RecaptchaVerifier(auth, freshRecaptchaElement(), { size: 'invisible' });
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
