/**
 * Business settings — decisions the business owns, not the code. The one list of them, imported by the Cloud
 * Functions and by both apps (src/config/settings.ts), so no side can drift from the other. Keep this file free of
 * imports: it is compiled by two separate TypeScript projects.
 *
 * Where a value comes from:
 *  - Local emulator: `SETTING_<NAME>` in the repo-root .env (e.g. SETTING_OTP_REUSE_SECONDS=60).
 *  - Production: the Firestore document `config/app` (managed with `make settings-show` / `settings-set`).
 * Anything missing or out of range falls back to the default below.
 */

type IntSetting = { kind: 'int'; default: number; min: number; max: number; description: string };
type TextSetting = { kind: 'text'; default: string; pattern: RegExp; description: string };

export const SETTINGS = {
  otpReuseSeconds: {
    kind: 'int', default: 180, min: 30, max: 900,
    description: 'How long one SMS code can be reused (login and sign up) before Send OTP sends a new one.',
  },
  otpMaxSendsPerHour: {
    kind: 'int', default: 3, min: 1, max: 20,
    description: 'New SMS codes one phone may request for one number per hour (reusing a code does not count).',
  },
  otpMaxWrongCodes: {
    kind: 'int', default: 5, min: 1, max: 20,
    description: 'Wrong codes allowed before the technician must request a new one.',
  },
  technicianMinAge: {
    kind: 'int', default: 18, min: 14, max: 99,
    description: 'Youngest age a technician can register with.',
  },
  technicianMaxAge: {
    kind: 'int', default: 70, min: 14, max: 120,
    description: 'Oldest age a technician can register with.',
  },
  maxExperienceYears: {
    kind: 'int', default: 50, min: 0, max: 100,
    description: 'Most years of experience a technician can enter.',
  },
  profileUpdateLifetimeCap: {
    kind: 'int', default: 2, min: 0, max: 100,
    description: 'Profile-change requests a technician may ever submit, whatever their outcome.',
  },
  supportPhoneNumber: {
    kind: 'text', default: '9646424964', pattern: /^\d{10}$/,
    description: 'Support number shown to technicians (10 digits).',
  },
} satisfies Record<string, IntSetting | TextSetting>;

export type SettingKey = keyof typeof SETTINGS;
export type Settings = { [K in SettingKey]: (typeof SETTINGS)[K]['default'] extends number ? number : string };

/** The validated value for one key, or undefined when `raw` isn't acceptable (wrong type or out of range). */
export function parseSetting(key: SettingKey, raw: unknown): number | string | undefined {
  const spec: IntSetting | TextSetting = SETTINGS[key];

  if (spec.kind === 'int') {
    const value = typeof raw === 'string' && raw.trim() ? Number(raw) : raw;
    return typeof value === 'number' && Number.isInteger(value) && value >= spec.min && value <= spec.max ? value : undefined;
  }

  return typeof raw === 'string' && spec.pattern.test(raw.trim()) ? raw.trim() : undefined;
}

/** Every setting, taking each value from `raw` when it's valid and the default otherwise. */
export function resolveSettings(raw: Record<string, unknown>): Settings {
  const resolved: Record<string, unknown> = {};

  for (const key of Object.keys(SETTINGS) as SettingKey[]) {
    resolved[key] = parseSetting(key, raw[key]) ?? SETTINGS[key].default;
  }

  return resolved as Settings;
}

/** `otpReuseSeconds` → `SETTING_OTP_REUSE_SECONDS`, the variable that sets it in a local .env. */
export const settingEnvName = (key: SettingKey) => `SETTING_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`;

/** Settings from `SETTING_*` environment variables — the local-emulator source. */
export function settingsFromEnv(env: Record<string, unknown>): Settings {
  const raw: Record<string, unknown> = {};

  for (const key of Object.keys(SETTINGS) as SettingKey[]) {
    raw[key] = env[settingEnvName(key)];
  }

  return resolveSettings(raw);
}

export const DEFAULT_SETTINGS: Settings = resolveSettings({});

/** The Firestore document holding production settings. */
export const SETTINGS_DOC_PATH = 'config/app';
