import { Capacitor } from '@capacitor/core';

import { firebaseOtpProvider } from './firebaseOtpProvider';
import { localOtpProvider } from './localOtpProvider';
import { nativeOtpProvider } from './nativeOtpProvider';
import type { OtpProvider } from './types';

export type { OtpProvider, OtpRequestResult, OtpSession } from './types';

/**
 * Picks the OTP provider from the same signal scripts/local-dev.mjs already
 * bakes into the build to point the Firebase SDK at the local Emulator
 * Suite (VITE_FIREBASE_EMULATOR_HOST — see src/firebase.ts). Deliberately
 * not a second, separate env var: local always means "emulator Firestore +
 * fake OTP" together, never one without the other, so there's exactly one
 * flag that can't drift out of sync with itself.
 *
 * Against real Firebase, the Android app uses the native SDK (nativeOtpProvider — Play Integrity, no web
 * reCAPTCHA, which fails for real numbers inside the WebView); the browser build keeps the web SDK.
 */
export const activeOtpProvider: OtpProvider = import.meta.env.VITE_FIREBASE_EMULATOR_HOST
  ? localOtpProvider
  : Capacitor.isNativePlatform()
    ? nativeOtpProvider
    : firebaseOtpProvider;
