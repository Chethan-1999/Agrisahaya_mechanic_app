import { resolveSettings, settingsFromEnv, SETTINGS_DOC_PATH, type Settings } from '../shared/settings';
import { db } from './firebaseAdmin';

// A settings change made with `make settings-set` reaches every function instance within this long.
const CACHE_MS = 60_000;

let cached: { settings: Settings; loadedAt: number } | null = null;

/** Business settings (shared/settings.ts): SETTING_* env vars in the emulator, the `config/app` document in production. */
export async function getSettings(): Promise<Settings> {
  if (process.env.FUNCTIONS_EMULATOR === 'true') return settingsFromEnv(process.env);

  if (cached && Date.now() - cached.loadedAt < CACHE_MS) return cached.settings;

  const snap = await db.doc(SETTINGS_DOC_PATH).get();
  cached = { settings: resolveSettings(snap.data() ?? {}), loadedAt: Date.now() };
  return cached.settings;
}
