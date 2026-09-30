import { doc, getDoc } from 'firebase/firestore';

import { DEFAULT_SETTINGS, resolveSettings, settingsFromEnv, SETTINGS_DOC_PATH, type Settings } from '../../functions/src/shared/settings';
import { db } from '../firebase';
import { withTimeout } from '../utils/withTimeout';

export type { Settings };

// The app still opens on a slow network — it just uses the fallback below for this session.
const LOAD_TIMEOUT_MS = 5000;

// A local-emulator build falls back to the SETTING_* values baked in from .env at build time.
let current: Settings = import.meta.env.VITE_FIREBASE_EMULATOR_HOST ? settingsFromEnv(import.meta.env) : DEFAULT_SETTINGS;

/**
 * Loads the business settings (functions/src/shared/settings.ts) once, before the app renders, from the `config/app`
 * document — production's, or the local emulator's, which the Docker backend fills from its SETTING_* environment
 * (.env + .env.pulled; docker/seed-settings.cjs) — so a local change needs a backend restart, not a new APK.
 * Never throws — the fallback above stays on failure.
 */
export async function loadSettings(): Promise<void> {
  try {
    const snap = await withTimeout(getDoc(doc(db, SETTINGS_DOC_PATH)), 'Loading settings timed out.', LOAD_TIMEOUT_MS);
    if (snap.exists()) current = resolveSettings(snap.data());
  } catch (err) {
    console.warn('Using fallback settings:', err);
  }
}

export const getSettings = (): Settings => current;
