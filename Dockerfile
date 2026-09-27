# The local Firebase backend (Auth, Firestore and Functions emulators) — run it with `make backend-up`.
# The Android emulator and the Vite dev server stay on the Mac; they reach this through the published ports.
FROM node:20-trixie-slim

# Java runs the Firestore and Auth emulators (firebase-tools 15 needs 21); curl is for the healthcheck and autosave.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openjdk-21-jre-headless curl \
  && rm -rf /var/lib/apt/lists/*

# Same version as the repo's devDependency, so the container and `npx firebase` on the Mac behave alike.
ARG FIREBASE_TOOLS_VERSION=15.30.0
RUN npm install -g firebase-tools@${FIREBASE_TOOLS_VERSION} --no-audit --no-fund \
  && firebase setup:emulators:firestore \
  && firebase setup:emulators:ui
# ↑ the Firestore emulator and UI are ~150 MB of downloads; baked in here once instead of on every fresh container.

WORKDIR /workspace

# Dependencies go into the image (and from there into the functions_node_modules volume on first run); the
# source itself is mounted from the repo, so edits show up without rebuilding.
COPY functions/package.json functions/package-lock.json functions/
RUN npm ci --prefix functions --no-audit --no-fund

COPY docker/backend.sh /usr/local/bin/backend
CMD ["backend"]
