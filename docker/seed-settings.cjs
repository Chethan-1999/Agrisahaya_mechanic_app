// Writes the business settings from this container's environment (SETTING_* from .env, then .env.pulled — see
// docker-compose.yml) into the local Firestore emulator's `config/app`, the same document production reads. The apps
// read that document at launch, so a changed value reaches an installed APK after `make backend-restart`, no rebuild.
// The functions read the same SETTING_* straight from the environment (lib/settings.ts), so both sides agree.
// Run by docker/backend.sh once the emulators answer; the healthcheck waits for the marker file it leaves behind.
const { writeFileSync } = require('node:fs');

const { settingsFromEnv, SETTINGS_DOC_PATH } = require('/workspace/functions/lib/shared/settings.js');

const [project, marker] = process.argv.slice(2);
const settings = settingsFromEnv(process.env);

const fields = Object.fromEntries(
  Object.entries(settings).map(([key, value]) => [key, typeof value === 'number' ? { integerValue: String(value) } : { stringValue: value }]),
);

// `Bearer owner` is the emulator's admin bypass of firestore.rules (which deny every client write).
fetch(`http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/${SETTINGS_DOC_PATH}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ fields }),
})
  .then(async (res) => {
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    writeFileSync(marker, '');
    console.log(`Local ${SETTINGS_DOC_PATH} set from the environment: ${JSON.stringify(settings)}`);
  })
  .catch((err) => {
    console.error(`Could not write local ${SETTINGS_DOC_PATH}:`, err.message);
    process.exit(1);
  });
