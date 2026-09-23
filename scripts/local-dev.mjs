#!/usr/bin/env node
// One command to test the mechanic OR admin app against a Firebase Emulator
// Suite running on THIS laptop, from a device/emulator on the same network:
//   npm run dev:local                  # mechanic app (default)
//   npm run dev:local -- --app admin   # admin app
//   npm run dev:local -- --apk         # phone-targeted APK build instead of the AVD emulator
//   npm run dev:local -- --app admin --phone-apk mechanic
//                                      # admin app in the AVD emulator AND a mechanic phone APK,
//                                      # both talking to the same local emulator suite
//   npm run dev:local -- --apk --phone-apk admin --prod
//                                      # two phone APKs (mechanic + admin) against PRODUCTION
//                                      # Firebase (the project in .env) — no AVD, no emulators;
//                                      # the script exits once both APKs are in dist/
//
// What it does, in order:
//   1. Detects this laptop's LAN IPv4 address, and checks whether adb already
//      sees a real physical device (as opposed to nothing, meaning this script
//      will boot its own AVD emulator).
//   2. Builds the web app (into ./dist) with the right Firebase-emulator host
//      baked in for whichever of those it's targeting: a real device needs the
//      actual LAN IP to reach this laptop over Wi-Fi, but the AVD emulator can
//      ONLY reach the host via the special 10.0.2.2 alias — its NAT network
//      can't route to the host's own real LAN interface (confirmed by testing:
//      packets to the LAN IP from inside the AVD come back corrupted, a NAT
//      hairpin failure). Using the wrong one for either target is a silent dead
//      end — the app just hangs on "Loading..." with a buried
//      "auth/network-request-failed" in the console, not a clear error.
//   3. Syncs the build into the Android project (with cleartext HTTP allowed, since
//      the emulator suite isn't served over TLS).
//   4. Boots the Android emulator if nothing is already connected, installs the
//      debug APK, and launches the app.
//   5. Starts a browser-accessible Vite dev server (http://localhost:5173), using
//      'localhost' for the emulator host since this process runs directly on the
//      host machine — no NAT hop to route around here.
//   6. Starts the Firebase Emulator Suite (Auth, Firestore, Functions) in the
//      foreground, bound to 0.0.0.0 so other devices on the network can reach it.
//      Ctrl+C stops everything (the dev server included — it's a child of this
//      process, not detached like the Android emulator).
//
// Works the same on macOS and Windows: every step below is plain Node.js — no
// bash-only syntax, so nothing here depends on WSL, Git Bash, or GNU Make.

import { spawnSync, spawn } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isWindows = process.platform === 'win32';
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const avdName = process.env.AVD_NAME || 'Pixel_6';
// Which Firebase project to run the emulators against comes from .firebaserc
// (the Firebase CLI's own config), not a literal here — one source of truth,
// shared with every other `firebase` command in this repo.

// Which app this run targets — `--app admin` runs the admin app instead of
// the default mechanic app. Each has its own native Android project, appId,
// and Capacitor config (see capacitor.config.ts / capacitor.admin.config.ts;
// android/ and android-admin/ are both gitignored, regenerated via
// `[CAP_APP=admin] npx cap add android`).
const APPS = {
  mechanic: {
    label: 'Mechanic',
    androidDir: path.join(repoRoot, 'android'),
    appId: 'com.agrisahaya.mechanic',
    capEnv: {},
    apkPrefix: 'agrisahaya-local',
    prodApkPrefix: 'agrisahaya-prod',
  },
  admin: {
    label: 'Admin',
    androidDir: path.join(repoRoot, 'android-admin'),
    appId: 'com.agrisahaya.admin',
    capEnv: { CAP_APP: 'admin' },
    apkPrefix: 'agrisahaya-admin-local',
    prodApkPrefix: 'agrisahaya-admin-prod',
  },
};
const appArgIndex = process.argv.indexOf('--app');
const appKey = appArgIndex !== -1 ? process.argv[appArgIndex + 1] : 'mechanic';
const app = APPS[appKey];
if (!app) fail(`Unknown --app "${appKey}". Expected "mechanic" or "admin".`);

function log(message) {
  console.log(`\n\x1b[36m[dev:local]\x1b[0m ${message}`);
}

function fail(message) {
  console.error(`\n\x1b[31m[dev:local]\x1b[0m ${message}`);
  process.exit(1);
}

// Runs a command via the shell (used for npm/npx-resolved tools, where Windows
// needs the .cmd shim resolved) and blocks until it exits. Throws on failure.
// Args are static/hardcoded call sites only (never user input), and folded into
// one command string — passing shell:true together with a separate args array
// is a Node deprecation (DEP0190) since args aren't escaped before concatenation.
function run(command, args, extraEnv = {}) {
  const result = spawnSync([command, ...args].join(' '), {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    fail(`Command failed (${result.status}): ${command} ${args.join(' ')}`);
  }
}

// Runs a resolved absolute binary directly (no shell), so paths containing spaces
// (e.g. "Android Studio.app") never need manual quoting.
function runBin(binPath, args, opts = {}) {
  const result = spawnSync(binPath, args, {
    stdio: 'inherit',
    shell: false,
    ...opts,
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (result.error) fail(`Failed to run ${binPath}: ${result.error.message}`);
  return result;
}

function capture(binPath, args, opts = {}) {
  return spawnSync(binPath, args, { shell: false, encoding: 'utf8', ...opts });
}

function sleepSyncMs(ms) {
  const sab = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(sab, 0, 0, ms); // blocking sleep, no child process, same on every OS
}

// -no-snapshot forces a clean cold boot every time. The crash mode we've hit
// before is the emulator booting fine, saving a snapshot, then silently dying
// on the *next* snapshot restore — skipping snapshots entirely removes that
// failure mode instead of trying to detect it after the fact.
function bootEmulator(emulatorBin, avdName, { wipeData }) {
  if (!existsSync(emulatorBin)) fail(`Emulator binary not found at ${emulatorBin}.`);
  log(`Booting emulator '${avdName}' (clean boot, no snapshot${wipeData ? ', wiped data' : ''})...`);
  const args = ['-avd', avdName, '-no-snapshot', '-no-boot-anim', ...(wipeData ? ['-wipe-data'] : [])];
  const child = spawn(emulatorBin, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

// Deliberately NOT detached, unlike bootEmulator above — this dev server
// should live and die with this script (Ctrl+C on the emulator suite below
// kills it too, since a non-detached child shares the parent's process
// group and gets the same SIGINT), not survive independently the way the
// Android emulator is meant to.
//
// Uses 'localhost' for the emulator host, not the LAN IP or the AVD's
// 10.0.2.2 alias — this process runs directly on the host machine (not
// inside any VM), so there's no NAT/network hop to route around here.
function startWebDevServer() {
  log(`Starting a browser dev server at http://localhost:${WEB_DEV_PORT} (log: ${WEB_DEV_LOG})...`);
  const logFd = openSync(WEB_DEV_LOG, 'a');
  spawn('npx', ['vite', 'dev', '--host', '0.0.0.0', '--port', String(WEB_DEV_PORT)], {
    cwd: repoRoot,
    stdio: ['ignore', logFd, logFd],
    shell: isWindows, // Windows needs the .cmd shim resolved via the shell
    env: { ...process.env, VITE_FIREBASE_EMULATOR_HOST: 'localhost' },
  });
}

const BOOT_TIMEOUT_MS = 90_000;
const BOOT_RETRIES = 3;

// Self-healing: if boot doesn't finish within BOOT_TIMEOUT_MS, or the emulator
// process disappears mid-boot, it's killed and retried with a wiped data
// partition — up to BOOT_RETRIES times — instead of hanging forever or
// leaving a half-booted emulator behind.
function waitForBootOrRecover(adb, emulatorBin, avdName) {
  for (let attempt = 1; attempt <= BOOT_RETRIES; attempt++) {
    log(`Waiting for boot (attempt ${attempt}/${BOOT_RETRIES}, timeout ${BOOT_TIMEOUT_MS / 1000}s)...`);
    runBin(adb, ['wait-for-device']);

    let waited = 0;
    for (;;) {
      const boot = capture(adb, ['shell', 'getprop', 'sys.boot_completed']).stdout?.trim();
      if (boot === '1') return;

      const devices = capture(adb, ['devices']).stdout || '';
      const stillConnected = devices
        .split('\n')
        .slice(1)
        .some((line) => line.trim().endsWith('device'));
      if (!stillConnected) {
        log('Emulator process disappeared mid-boot.');
        break;
      }
      if (waited >= BOOT_TIMEOUT_MS) {
        log(`Boot timed out after ${BOOT_TIMEOUT_MS / 1000}s.`);
        break;
      }
      sleepSyncMs(2000);
      waited += 2000;
    }

    if (attempt < BOOT_RETRIES) {
      log('Recovering: killing emulator and retrying with a wiped data partition...');
      runBin(adb, ['emu', 'kill']);
      sleepSyncMs(3000);
      bootEmulator(emulatorBin, avdName, { wipeData: true });
    }
  }
  fail(`Emulator failed to boot after ${BOOT_RETRIES} attempts.`);
}

// `adb shell am start` returns success even if the app crashes immediately
// on launch — poll for the process actually staying alive for a few seconds
// instead of trusting the start command's exit code alone.
function verifyAppLaunched(adb, appId, { timeoutMs = 12_000, settleMs = 2000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pid = capture(adb, ['shell', 'pidof', appId]).stdout?.trim();
    if (pid) {
      sleepSyncMs(settleMs);
      const stillAlive = capture(adb, ['shell', 'pidof', appId]).stdout?.trim();
      return Boolean(stillAlive);
    }
    sleepSyncMs(500);
  }
  return false;
}

// The Firebase emulators fail with a confusing, easy-to-miss "port not open,
// could not start" per-service warning (rather than a clear error) when a
// previous run's process got orphaned — e.g. this script's terminal was
// killed instead of Ctrl+C'd, leaving `firebase emulators:start` and the
// Firestore JAR running. Check up front and name the actual conflicting port.
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

// `--apk`: build a debug APK for a physical phone (laptop LAN IP baked in), skip the AVD, then run the
// emulators here. Install dist/agrisahaya-local-*.apk on the phone; its traffic and logs show up in this terminal.
const PHONE_APK = process.argv.includes('--apk');

// `--phone-apk <app>`: also build a phone APK for <app> (LAN IP baked in) — e.g. `--app admin
// --phone-apk mechanic` runs the admin app in the AVD and gives you a mechanic APK for your phone.
// With `--apk` there's no AVD run at all: you just get phone APKs for both apps. The builds may need
// different hosts (10.0.2.2 vs the LAN IP), so the extra APK is built, synced, and assembled first,
// before dist/ is rebuilt for the main app.
const phoneApkArgIndex = process.argv.indexOf('--phone-apk');
const phoneApkApp = phoneApkArgIndex !== -1 ? APPS[process.argv[phoneApkArgIndex + 1]] : null;
if (phoneApkArgIndex !== -1 && !phoneApkApp) {
  fail(`Unknown --phone-apk "${process.argv[phoneApkArgIndex + 1]}". Expected "mechanic" or "admin".`);
}
if (phoneApkApp === app) fail(`--phone-apk ${appKey} is the same app as --app; pick the other one.`);

// `--prod`: every build talks to production Firebase (whatever project .env points at) instead of
// the local emulator suite — no emulator host baked in, no cleartext/http scheme, no emulators
// started. Same device/APK handling otherwise, so you can smoke-test a real deploy end to end.
const PROD = process.argv.includes('--prod');

const WEB_DEV_PORT = 5173;
const WEB_DEV_LOG = path.join(os.tmpdir(), 'agrisahaya-vite-dev.log');

async function checkEmulatorPortsFree() {
  const ports = [8080, 9099, 5001, 4000, 4400, 4500, 9150, WEB_DEV_PORT];
  const busy = [];
  for (const port of ports) {
    if (!(await isPortFree(port))) busy.push(port);
  }
  if (busy.length > 0) {
    const howToFind = isWindows
      ? `netstat -ano | findstr :${busy[0]}`
      : `lsof -i :${busy[0]} -sTCP:LISTEN`;
    fail(
      `Port(s) ${busy.join(', ')} are already in use — most likely an orphaned Firebase emulator or ` +
        `Vite dev server from a previous run (e.g. this script's terminal was closed instead of Ctrl+C'd).\n` +
        `Find and stop it:\n  ${howToFind}\n` +
        (isWindows ? '  taskkill /PID <pid> /F' : '  kill <pid>'),
    );
  }
}

function detectLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs || []) {
      if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
        candidates.push({ name, address: addr.address });
      }
    }
  }
  if (candidates.length === 0) {
    fail('Could not find a LAN IPv4 address on this machine. Connect to Wi-Fi/Ethernet and try again.');
  }
  const preferred = candidates.find((c) => /^(en0|wl|eth|Wi-?Fi|Ethernet)/i.test(c.name));
  return (preferred || candidates[0]).address;
}

function resolveAndroidHome() {
  if (process.env.ANDROID_HOME && existsSync(process.env.ANDROID_HOME)) return process.env.ANDROID_HOME;
  if (process.env.ANDROID_SDK_ROOT && existsSync(process.env.ANDROID_SDK_ROOT)) return process.env.ANDROID_SDK_ROOT;
  const guesses = isWindows
    ? [path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')]
    : [path.join(os.homedir(), 'Library', 'Android', 'sdk'), path.join(os.homedir(), 'Android', 'Sdk')];
  const found = guesses.find((p) => p && existsSync(p));
  if (!found) {
    fail(
      'Could not find the Android SDK. Set ANDROID_HOME (or ANDROID_SDK_ROOT) to your SDK path, e.g.\n' +
        (isWindows ? '  setx ANDROID_HOME "%LOCALAPPDATA%\\Android\\Sdk"' : '  export ANDROID_HOME="$HOME/Library/Android/sdk"'),
    );
  }
  return found;
}

function resolveJavaHome() {
  if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  const guesses = isWindows
    ? [
        'C:\\Program Files\\Android\\Android Studio\\jbr',
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Android Studio', 'jbr'),
      ]
    : ['/Applications/Android Studio.app/Contents/jbr/Contents/Home'];
  const found = guesses.find((p) => existsSync(path.join(p, 'bin', isWindows ? 'java.exe' : 'java')));
  if (found) return found;
  // Fall back to whatever `java` is on PATH (gradle will fail with a clear error if none exists).
  return undefined;
}

// android/ is gitignored and regenerated via `npx cap add android` (see
// README), so anything hand-edited under it is lost on the next
// regeneration. This writes it back every run instead of relying on it
// surviving in git. Debug-only (src/debug/), so it never reaches a release
// build: Android blocks cleartext (plain HTTP) traffic by default on API
// 28+, and the emulator suite has no TLS cert to serve over HTTPS.
function ensureDebugCleartextConfig(androidDir) {
  const debugDir = path.join(androidDir, 'app', 'src', 'debug');
  mkdirSync(path.join(debugDir, 'res', 'xml'), { recursive: true });

  writeFileSync(
    path.join(debugDir, 'res', 'xml', 'network_security_config.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<!-- Regenerated by scripts/local-dev.mjs — debug builds only, never the release build. -->\n` +
      `<network-security-config>\n    <base-config cleartextTrafficPermitted="true" />\n</network-security-config>\n`,
  );

  writeFileSync(
    path.join(debugDir, 'AndroidManifest.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<!-- Regenerated by scripts/local-dev.mjs — pairs with res/xml/network_security_config.xml. -->\n` +
      `<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n` +
      `    <application android:networkSecurityConfig="@xml/network_security_config" />\n</manifest>\n`,
  );
}

// Builds both apps into dist/ with `firebaseHost` baked in, then syncs the build into
// `targetApp`'s Android project. Anything synced earlier keeps its own copy of the assets,
// so rebuilding dist/ afterwards for a different host doesn't touch it. A null
// `firebaseHost` (--prod) builds against production Firebase instead.
function buildAndSync(targetApp, firebaseHost) {
  log(
    firebaseHost
      ? `Building the web app (both apps) with Firebase emulator host ${firebaseHost} baked in...`
      : 'Building the web app (both apps) against PRODUCTION Firebase (no emulator host)...',
  );
  // Set explicitly (even to '') so a VITE_FIREBASE_EMULATOR_HOST exported in the shell can't
  // leak into a --prod build — process env takes priority over .env in Vite.
  const buildEnv = { VITE_FIREBASE_EMULATOR_HOST: firebaseHost ?? '' };
  // Two builds: mechanic → dist/, admin → dist/admin/ (self-contained; see vite.admin.config.ts).
  // Note the mechanic build empties dist/, including any APK copied there earlier.
  run('npx', ['vite', 'build'], buildEnv);
  run('npx', ['vite', 'build', '--config', 'vite.admin.config.ts'], buildEnv);

  if (!firebaseHost) {
    log(`Syncing the build into the ${targetApp.label} Android project...`);
    run('npx', ['cap', 'sync', 'android'], targetApp.capEnv);
    return;
  }
  log(`Syncing the build into the ${targetApp.label} Android project (cleartext HTTP enabled for this build only)...`);
  run('npx', ['cap', 'sync', 'android'], { ...targetApp.capEnv, CAP_LOCAL_DEV: '1' });
  ensureDebugCleartextConfig(targetApp.androidDir);
}

function apkPaths(targetApp, stamp) {
  return {
    apkSource: path.join(targetApp.androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
    apkOut: path.join(repoRoot, 'dist', `${PROD ? targetApp.prodApkPrefix : targetApp.apkPrefix}-${stamp}.apk`),
  };
}

function assemblePhoneApk(targetApp, gradleEnv) {
  const gradlew = path.join(targetApp.androidDir, isWindows ? 'gradlew.bat' : 'gradlew');
  log(`Building the ${targetApp.label} phone APK (debug-signed)...`);
  const buildResult = runBin(gradlew, ['assembleDebug'], { cwd: targetApp.androidDir, env: gradleEnv });
  if (buildResult.status !== 0) fail('Gradle build failed. See output above.');
}

// Copies an assembled APK into dist/. Call it only after the last web build of the
// run — the mechanic vite build empties dist/.
function savePhoneApk(targetApp, lanIp, stamp) {
  const { apkSource, apkOut } = apkPaths(targetApp, stamp);
  copyFileSync(apkSource, apkOut);
  log(`Phone APK ready: ${apkOut}`);
  log(
    lanIp
      ? `It talks to ${lanIp} — the phone must be on the same network as this laptop. Rebuild if the IP changes.`
      : 'It talks to production Firebase — works on any network.',
  );
  return apkOut;
}

// src/firebase.ts only console.errors on a missing config, so a build without it still installs and
// "launches" fine — verifyAppLaunched can't tell. Refuse to build instead of shipping a dead APK.
const REQUIRED_FIREBASE_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

function requireFirebaseConfig() {
  const envPath = path.join(repoRoot, '.env');
  const fileVars = existsSync(envPath)
    ? Object.fromEntries(
        readFileSync(envPath, 'utf8')
          .split(/\r?\n/)
          .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
          .filter(Boolean)
          .map((m) => [m[1], m[2]]),
      )
    : {};
  const missing = REQUIRED_FIREBASE_KEYS.filter((key) => !process.env[key] && !fileVars[key]);
  if (missing.length > 0) {
    fail(`.env is missing Firebase config: ${missing.join(', ')}. Copy .env.example to .env and fill it in.`);
  }
}

function requireAndroidProject(targetApp) {
  if (!existsSync(targetApp.androidDir)) {
    fail(`No ${path.basename(targetApp.androidDir)}/ project found. Run "${targetApp.capEnv.CAP_APP ? 'CAP_APP=admin ' : ''}npx cap add android" first.`);
  }
}

async function main() {
  // --prod never talks to this laptop, so it doesn't need (or require) a LAN IP.
  const lanIp = PROD ? null : detectLanIp();

  log(`Targeting the ${app.label} app (${app.appId})${PROD ? ' against PRODUCTION Firebase' : ''}.`);

  const androidHome = resolveAndroidHome();
  const javaHome = resolveJavaHome();
  const adb = path.join(androidHome, 'platform-tools', isWindows ? 'adb.exe' : 'adb');
  const emulatorBin = path.join(androidHome, 'emulator', isWindows ? 'emulator.exe' : 'emulator');
  const gradlew = path.join(app.androidDir, isWindows ? 'gradlew.bat' : 'gradlew');
  if (!existsSync(adb)) fail(`adb not found at ${adb}. Check your Android SDK install.`);
  requireFirebaseConfig();
  requireAndroidProject(app);
  if (phoneApkApp) requireAndroidProject(phoneApkApp);

  // The AVD emulator this script boots can only reach the host machine via
  // the special 10.0.2.2 loopback alias — its slirp/NAT network cannot
  // route to the host's own real LAN interface (confirmed: pinging the LAN
  // IP from inside the AVD gets corrupted/duplicate replies, a NAT hairpin
  // failure, not a clean timeout). Baking the LAN IP into a build destined
  // for the AVD is a dead end that surfaces as a buried
  // "auth/network-request-failed" deep in the Firebase SDK, not a clear
  // connection error. A real physical device on Wi-Fi (adb serial doesn't
  // start with "emulator-") has no such alias and genuinely needs the LAN
  // IP instead — so the two targets need two different builds.
  runBin(adb, ['start-server']);
  const connectedSerials = (capture(adb, ['devices']).stdout || '')
    .split('\n')
    .slice(1)
    .filter((line) => line.trim().endsWith('device')) // excludes offline/unauthorized entries
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean);
  const hasPhysicalDevice = connectedSerials.some((serial) => !serial.startsWith('emulator-'));
  const androidFirebaseHost = PROD ? null : PHONE_APK || hasPhysicalDevice ? lanIp : '10.0.2.2';

  if (!PROD) log(`This laptop's LAN IP: ${lanIp} (used for the browser dev server and any physical device on Wi-Fi).`);
  log(
    PROD
      ? 'Production mode — every build talks to the Firebase project in .env; no emulators are started.'
      : PHONE_APK
      ? 'Building a phone APK — using the LAN IP so the phone can reach this laptop over the shared network.'
      : hasPhysicalDevice
      ? 'A physical device is connected — building for it with the LAN IP so it can reach this laptop over Wi-Fi.'
      : "Targeting the AVD emulator — building with its 10.0.2.2 host alias, since the LAN IP isn't reachable from inside it.",
  );

  mkdirSync(path.join(repoRoot, 'dist'), { recursive: true });

  run('npx', ['tsc', '--noEmit']);

  const gradleEnv = javaHome ? { JAVA_HOME: javaHome } : {};
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
  const { apkSource, apkOut } = apkPaths(app, stamp);

  // Phone APK first: its LAN-IP build must be synced + assembled before dist/ is
  // rebuilt below with the AVD's 10.0.2.2 host.
  let extraPhoneApk = null;
  if (phoneApkApp) {
    log(`Also building a ${phoneApkApp.label} phone APK (--phone-apk)${PROD ? '' : `, using the LAN IP ${lanIp}`}...`);
    buildAndSync(phoneApkApp, lanIp);
    assemblePhoneApk(phoneApkApp, gradleEnv);
  }

  buildAndSync(app, androidFirebaseHost);
  // Now that dist/ won't be rebuilt again, the phone APK can be copied into it.
  if (phoneApkApp) extraPhoneApk = savePhoneApk(phoneApkApp, lanIp, stamp);

  if (PHONE_APK) {
    assemblePhoneApk(app, gradleEnv);
    savePhoneApk(app, lanIp, stamp);
  } else {
    log('Checking for a connected Android device/emulator...');
    const hasDevice = connectedSerials.length > 0;

    if (!hasDevice) {
      bootEmulator(emulatorBin, avdName, { wipeData: false });
    } else {
      log('A device/emulator is already connected.');
    }

    waitForBootOrRecover(adb, emulatorBin, avdName);
    log('Device ready.');

    log(`Building and installing the ${app.label} debug APK...`);
    const installResult = runBin(gradlew, ['installDebug'], { cwd: app.androidDir, env: gradleEnv });
    if (installResult.status !== 0) fail('Gradle build/install failed. See output above.');

    // installDebug assembles app-debug.apk as a dependency, so it's already there to copy —
    // this way every run (not just --apk) leaves a testable artifact behind in dist/.
    copyFileSync(apkSource, apkOut);
    log(`APK also saved to ${apkOut} (installs on any device with "install unknown apps" enabled).`);

    log(`Launching the ${app.label} app...`);
    runBin(adb, ['shell', 'am', 'start', '-n', `${app.appId}/.MainActivity`]);

    log('Verifying the app actually launched (not just that the install succeeded)...');
    if (verifyAppLaunched(adb, app.appId)) {
      log(`${app.label} app is running and did not crash on startup.`);
    } else {
      fail(
        `${app.label} app did not stay running after launch — check "adb logcat" for a crash, ` +
          `or run \`make logs${app === APPS.admin ? '-admin' : ''}\` once the emulators below are up.`,
      );
    }
  }

  if (PROD) {
    if (extraPhoneApk) log(`Phone APK (${phoneApkApp.label}): ${extraPhoneApk} — install it on a phone.`);
    log('Done. Everything above talks to production Firebase — check `npx firebase functions:log` for backend errors.');
    process.exit(0);
  }

  if (existsSync(path.join(repoRoot, 'functions', 'package.json'))) {
    log('Building Cloud Functions...');
    const functionsBuild = spawnSync('npm run build', {
      cwd: path.join(repoRoot, 'functions'),
      stdio: 'inherit',
      shell: true,
    });
    if (functionsBuild.status !== 0) fail('Cloud Functions build failed. See output above.');
  }

  log('Checking that the emulator ports are free...');
  await checkEmulatorPortsFree();

  startWebDevServer();

  log(`Starting the Firebase Emulator Suite on 0.0.0.0 (reachable at ${lanIp})...`);
  log(`Browser:    http://localhost:${WEB_DEV_PORT}   (talks to this same local emulator)`);
  log('Emulator UI: http://localhost:4000   Ctrl+C to stop everything.');
  if (extraPhoneApk) log(`Phone APK (${phoneApkApp.label}): ${extraPhoneApk} — install it on your phone (same network as ${lanIp}).`);
  // The Firebase CLI shells out to `java` on PATH (not JAVA_HOME) for the Firestore/Auth
  // emulators, so make sure the resolved JDK's bin/ is actually on PATH for this step.
  const pathWithJava = javaHome
    ? `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH}`
    : process.env.PATH;
  // Persist Auth + Firestore across restarts. Import the last export if there is one, export on a
  // clean exit, AND export every 30s through the emulator hub so a killed terminal or a crash
  // loses at most the last 30 seconds instead of the whole session.
  const dataDir = path.join(repoRoot, 'emulator-data');
  const hasExport = existsSync(path.join(dataDir, 'firebase-export-metadata.json'));
  const args = ['firebase', 'emulators:start', '--only', 'auth,firestore,functions', `--export-on-exit=${dataDir}`];
  if (hasExport) args.push(`--import=${dataDir}`);
  if (hasExport) {
    // Keep the previous export: a session that starts from bad/empty data would otherwise overwrite the only good copy.
    const backupDir = `${dataDir}.bak`;
    rmSync(backupDir, { recursive: true, force: true });
    cpSync(dataDir, backupDir, { recursive: true });
    let users = [];
    try {
      users = JSON.parse(readFileSync(path.join(dataDir, 'auth_export', 'accounts.json'), 'utf8')).users ?? [];
    } catch {
      // unreadable accounts file: report zero users below
    }
    log(`Restoring emulator data from ${dataDir} (${users.length} auth user(s): ${users.map((u) => u.email || u.phoneNumber).join(', ') || 'none'}). Previous copy kept in ${backupDir}.`);
  } else {
    log(`No saved emulator data yet — starting empty; will save to ${dataDir}. Create the admin once (see README).`);
  }

  const emulators = spawn(['npx', ...args].join(' '), {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PATH: pathWithJava },
  });

  const exportTimer = setInterval(() => {
    fetch('http://127.0.0.1:4400/_admin/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dataDir, initiatedBy: 'local-dev-autosave' }),
    }).catch(() => undefined);
  }, 30_000);

  // Ctrl+C reaches the emulator too (same process group); stay alive until its export-on-exit finishes.
  process.on('SIGINT', () => undefined);
  process.on('SIGTERM', () => emulators.kill('SIGINT'));

  await new Promise((resolve) => emulators.once('close', resolve));
  clearInterval(exportTimer);
  log('Emulators stopped; data saved to emulator-data/.');
  process.exit(0);
}

main().catch((err) => fail(err.stack || String(err)));
