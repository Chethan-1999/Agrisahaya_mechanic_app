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

/**
 * Biometric-shortcut for PIN login — NOT a separate auth path. A successful
 * fingerprint/face prompt here only decrypts a phone+PIN pair stored on this
 * device (via the plugin's own Keystore-backed setCredentials/getCredentials);
 * whatever comes back still has to pass through loginWithPin on the server
 * like manual entry does. See patches/capacitor-native-biometric+4.2.2.patch —
 * the underlying Keystore key is patched to invalidate itself the moment the
 * device's enrolled biometrics change, so a stale shortcut can't survive a
 * new fingerprint being added; any failure here (including that invalidation)
 * is treated as "shortcut is gone" and torn down, never surfaced as a retryable error.
 */
const PIN_CREDENTIAL_SERVER = 'agrisahaya-pin';
const BIOMETRIC_PIN_FLAG = 'agrisahaya.biometricPinEnabled';

export function isBiometricPinEnabled(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_PIN_FLAG) === '1';
  } catch {
    return false;
  }
}

export async function enableBiometricPin(phoneNumber: string, pin: string): Promise<void> {
  await NativeBiometric.setCredentials({ username: phoneNumber, password: pin, server: PIN_CREDENTIAL_SERVER });
  try {
    localStorage.setItem(BIOMETRIC_PIN_FLAG, '1');
  } catch {
    // localStorage unavailable — the credential is still stored natively, just without the local flag.
  }
}

export async function disableBiometricPin(): Promise<void> {
  try {
    await NativeBiometric.deleteCredentials({ server: PIN_CREDENTIAL_SERVER });
  } catch {
    // already gone
  }
  try {
    localStorage.removeItem(BIOMETRIC_PIN_FLAG);
  } catch {
    // ignore
  }
}

/**
 * Returns the stored phone+PIN after a successful biometric prompt, or null
 * if unavailable/cancelled/not enrolled. Any credential-retrieval failure —
 * including the device's biometrics having changed since the credential was
 * stored — clears the local shortcut entirely, so the caller falls back to
 * manual PIN entry (or full OTP recovery) rather than retrying a broken shortcut.
 */
export async function tryBiometricPinLogin(): Promise<{ phoneNumber: string; pin: string } | null> {
  if (!Capacitor.isNativePlatform() || !isBiometricPinEnabled()) return null;

  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Sign in to AgriSahaya',
      title: 'Unlock',
      useFallback: true,
      maxAttempts: 3,
    });
    const { username, password } = await NativeBiometric.getCredentials({ server: PIN_CREDENTIAL_SERVER });
    return { phoneNumber: username, pin: password };
  } catch {
    await disableBiometricPin();
    return null;
  }
}
