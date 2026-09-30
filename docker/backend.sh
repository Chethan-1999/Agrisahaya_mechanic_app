#!/bin/sh
# Starts the local Firebase backend inside the `backend` container (docker-compose.yml): the Auth, Firestore and
# Functions emulators, with the functions rebuilt whenever a file under functions/src changes.
set -e
cd /workspace

PROJECT=$(node -p "JSON.parse(require('fs').readFileSync('.firebaserc', 'utf8')).projects.default")
DATA_DIR=/workspace/emulator-data

# Cheap when nothing changed; picks up a new functions dependency without rebuilding the image.
npm install --prefix functions --no-audit --no-fund --loglevel=error
npm run --prefix functions build
# Rebuild on save — the Functions emulator reloads from functions/lib by itself.
npx --prefix functions tsc -p functions --watch --preserveWatchOutput &

IMPORT=""
if [ -f "$DATA_DIR/firebase-export-metadata.json" ]; then
  # Keep the previous export: a session that starts from bad/empty data would otherwise overwrite the only good copy.
  rm -rf "$DATA_DIR.bak" && cp -R "$DATA_DIR" "$DATA_DIR.bak"
  IMPORT="--import=$DATA_DIR"
  echo "Restoring emulator data from emulator-data/ (previous copy kept in emulator-data.bak/)."
else
  echo "No saved emulator data yet — starting empty. Create the admin once: make admin ADMIN_EMAIL=... ADMIN_PASSWORD=..."
fi

# Once every emulator answers, copy the SETTING_* environment into the local config/app (docker/seed-settings.cjs).
# The healthcheck (docker-compose.yml) waits for the marker, so `make backend-up` returns only after this.
SEEDED=/tmp/settings-seeded
rm -f "$SEEDED"
( until curl -fs http://127.0.0.1:8080 >/dev/null 2>&1 && curl -s -o /dev/null http://127.0.0.1:5001; do sleep 1; done
  until node docker/seed-settings.cjs "$PROJECT" "$SEEDED"; do sleep 2; done ) &

# Besides the export on a clean stop, save every 30s so a crash or a killed Docker loses at most 30 seconds.
( while sleep 30; do
    curl -fs http://127.0.0.1:8080 >/dev/null 2>&1 || continue # Firestore not up yet
    curl -fsS -X POST http://127.0.0.1:4400/_admin/export -H 'Content-Type: application/json' \
      -d "{\"path\":\"$DATA_DIR\",\"initiatedBy\":\"docker-autosave\"}" >/dev/null 2>&1 || true
  done ) &

exec firebase emulators:start --only auth,firestore,functions --project "$PROJECT" $IMPORT --export-on-exit="$DATA_DIR"
