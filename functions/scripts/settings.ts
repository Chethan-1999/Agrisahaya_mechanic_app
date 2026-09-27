/**
 * Shows and changes the production business settings — the Firestore document `config/app`
 * (src/shared/settings.ts lists every key, its default and allowed range). Local testing uses SETTING_* in the
 * repo-root .env instead, so this script is for the real project only.
 *
 * Local only, like create-admin.ts — needs the service account key in functions/.env.scripts.
 *
 * Usage (from the repo root):
 *   make settings-show
 *   make settings-set KEY=otpMaxSendsPerHour VALUE=4
 *   make settings-seed        # writes every missing key with its default; never overwrites a set value
 */
import path from 'node:path';

import { config } from 'dotenv';

// NOT functions/.env — see create-admin.ts.
config({ path: path.resolve(__dirname, '../.env.scripts') });

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { parseSetting, resolveSettings, SETTINGS, SETTINGS_DOC_PATH, type SettingKey } from '../src/shared/settings';

const isSettingKey = (key: string | undefined): key is SettingKey => Boolean(key && key in SETTINGS);

async function main() {
  const [command, key, value] = process.argv.slice(2);
  const ref = getFirestore(initializeApp()).doc(SETTINGS_DOC_PATH);
  const stored = (await ref.get()).data() ?? {};

  if (command === 'show') {
    const effective = resolveSettings(stored);
    for (const name of Object.keys(SETTINGS) as SettingKey[]) {
      const source = parseSetting(name, stored[name]) !== undefined ? 'set' : name in stored ? 'INVALID, using default' : 'default';
      console.log(`${name.padEnd(26)} ${String(effective[name]).padEnd(12)} (${source}) — ${SETTINGS[name].description}`);
    }
    return;
  }

  if (command === 'set') {
    if (!isSettingKey(key)) throw new Error(`Unknown setting "${key}". Known: ${Object.keys(SETTINGS).join(', ')}`);
    const parsed = parseSetting(key, value);
    if (parsed === undefined) {
      const spec = SETTINGS[key];
      throw new Error(`"${value}" isn't allowed for ${key} (${'min' in spec ? `whole number ${spec.min}–${spec.max}` : `must match ${spec.pattern}`}).`);
    }
    await ref.set({ [key]: parsed }, { merge: true });
    console.log(`${key} = ${parsed}. Apps pick it up on their next launch, functions within a minute.`);
    return;
  }

  if (command === 'seed') {
    const missing = Object.fromEntries(
      (Object.keys(SETTINGS) as SettingKey[]).filter((name) => parseSetting(name, stored[name]) === undefined).map((name) => [name, SETTINGS[name].default]),
    );
    await ref.set(missing, { merge: true });
    console.log(Object.keys(missing).length ? `Wrote defaults for: ${Object.keys(missing).join(', ')}` : 'Every setting is already set.');
    return;
  }

  console.error('Usage: npm run settings -- show | set <key> <value> | seed');
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
