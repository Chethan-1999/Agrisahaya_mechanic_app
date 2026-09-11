import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from 'capacitor-native-biometric';

/**
 * Device-level app-lock over an already-persisted Firebase session — not a
 * second auth system. See Blueprint §07 "What the biometric gate is (and
 * isn't)". No-ops (returns true, i.e. "unlocked") on web, so the dev/browser
 * preview isn't blocked by a prompt that can't exist there.
 *
 * NOT verified on a real device — wire this in, then confirm the prompt
 * actually appears (Face/Fingerprint/PIN) and both the success and
 * cancel/fail paths behave as expected before relying on it.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const result = await NativeBiometric.isAvailable({ useFallback: true });
    return result.isAvailable;
  } catch {
    return false;
  }
}

/** Resolves true if the device unlocked (or biometrics aren't available/native — never blocks web). */
export async function unlockWithBiometrics(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;

  const available = await isBiometricAvailable();
  if (!available) return true;

  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Unlock AgriSahaya',
      title: 'Unlock',
      useFallback: true,
      maxAttempts: 3,
    });
    return true;
  } catch {
    return false;
  }
}
