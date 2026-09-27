import { doc, getDoc } from 'firebase/firestore';

import { DEFAULT_SETTINGS, resolveSettings, settingsFromEnv, SETTINGS_DOC_PATH, type Settings } from '../../functions/src/shared/settings';
import { db } from '../firebase';
import { withTimeout } from '../utils/withTimeout';

export type { Settings };

// The app still opens on a slow network — it just uses the defaults for this session.
const LOAD_TIMEOUT_MS = 5000;

let current: Settings = DEFAULT_SETTINGS;

/**
 * Loads the business settings (functions/src/shared/settings.ts) once, before the app renders: SETTING_* values from
 * .env in a local-emulator build, the `config/app` document otherwise. Never throws — defaults stay on failure.
 */
export async function loadSettings(): Promise<void> {
  if (import.meta.env.VITE_FIREBASE_EMULATOR_HOST) {
    current = settingsFromEnv(import.meta.env);
    return;
  }

  try {
    const snap = await withTimeout(getDoc(doc(db, SETTINGS_DOC_PATH)), 'Loading settings timed out.', LOAD_TIMEOUT_MS);
    current = resolveSettings(snap.data() ?? {});
  } catch (err) {
    console.warn('Using default settings:', err);
  }
}

export const getSettings = (): Settings => current;
