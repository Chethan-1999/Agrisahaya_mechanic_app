#!/usr/bin/env node
// One command to test the app against a Firebase Emulator Suite running on THIS
// laptop, from a device/emulator on the same network:
//   npm run dev:local
//
// What it does, in order:
//   1. Detects this laptop's LAN IPv4 address.
//   2. Builds the web app (into ./dist) with that IP baked in, so the Firebase SDK
//      talks to the local emulators instead of production Firebase.
//   3. Syncs the build into the Android project (with cleartext HTTP allowed, since
//      the emulator suite isn't served over TLS).
//   4. Boots the Android emulator if nothing is already connected, installs the
//      debug APK, and launches the app.
//   5. Starts the Firebase Emulator Suite (Auth, Firestore, Functions) in the
//      foreground, bound to 0.0.0.0 so other devices on the network can reach it.
//      Ctrl+C stops it.
//
// Works the same on macOS and Windows: every step below is plain Node.js — no
// bash-only syntax, so nothing here depends on WSL, Git Bash, or GNU Make.

import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isWindows = process.platform === 'win32';
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const androidDir = path.join(repoRoot, 'android');
const appId = 'com.agrisahaya.mechanic';
const avdName = process.env.AVD_NAME || 'Pixel_6';
// Which Firebase project to run the emulators against comes from .firebaserc
// (the Firebase CLI's own config), not a literal here — one source of truth,
// shared with every other `firebase` command in this repo.

function log(message) {
  console.log(`\n\x1b[36m[dev:local]\x1b[0m ${message}`);
}

function fail(message) {
  console.error(`\n\x1b[31m[dev:local]\x1b[0m ${message}`);
  process.exit(1);
}

// Runs a command via the shell (used for npm/npx-resolved tools, where Windows
// needs the .cmd shim resolved) and blocks until it exits. Throws on failure.
function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
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
function ensureDebugCleartextConfig() {
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

function main() {
  const lanIp = detectLanIp();
  log(`Using this laptop's LAN IP for Firebase: ${lanIp}`);
  log('Other devices must be on the same Wi-Fi/network to reach it.');

  const androidHome = resolveAndroidHome();
  const javaHome = resolveJavaHome();
  const adb = path.join(androidHome, 'platform-tools', isWindows ? 'adb.exe' : 'adb');
  const emulatorBin = path.join(androidHome, 'emulator', isWindows ? 'emulator.exe' : 'emulator');
  const gradlew = path.join(androidDir, isWindows ? 'gradlew.bat' : 'gradlew');
  if (!existsSync(adb)) fail(`adb not found at ${adb}. Check your Android SDK install.`);
  if (!existsSync(androidDir)) fail(`No android/ project found. Run "npx cap add android" first.`);

  mkdirSync(path.join(repoRoot, 'dist'), { recursive: true });

  log('Building the web app with the local Firebase emulator host baked in...');
  run('npx', ['tsc', '--noEmit']);
  run('npx', ['vite', 'build'], { VITE_FIREBASE_EMULATOR_HOST: lanIp });

  log('Syncing the build into the Android project (cleartext HTTP enabled for this build only)...');
  run('npx', ['cap', 'sync', 'android'], { CAP_LOCAL_DEV: '1' });
  ensureDebugCleartextConfig();

  log('Checking for a connected Android device/emulator...');
  runBin(adb, ['start-server']);
  const devices = capture(adb, ['devices']).stdout || '';
  const hasDevice = devices
    .split('\n')
    .slice(1)
    .some((line) => line.trim().endsWith('device'));

  if (!hasDevice) {
    bootEmulator(emulatorBin, avdName, { wipeData: false });
  } else {
    log('A device/emulator is already connected.');
  }

  waitForBootOrRecover(adb, emulatorBin, avdName);
  log('Device ready.');

  log('Building and installing the debug APK...');
  const gradleEnv = javaHome ? { JAVA_HOME: javaHome } : {};
  const installResult = runBin(gradlew, ['installDebug'], { cwd: androidDir, env: gradleEnv });
  if (installResult.status !== 0) fail('Gradle build/install failed. See output above.');

  log('Launching the app...');
  runBin(adb, ['shell', 'am', 'start', '-n', `${appId}/.MainActivity`]);

  if (existsSync(path.join(repoRoot, 'functions', 'package.json'))) {
    log('Building Cloud Functions...');
    const functionsBuild = spawnSync('npm', ['run', 'build'], {
      cwd: path.join(repoRoot, 'functions'),
      stdio: 'inherit',
      shell: true,
    });
    if (functionsBuild.status !== 0) fail('Cloud Functions build failed. See output above.');
  }

  log(`Starting the Firebase Emulator Suite on 0.0.0.0 (reachable at ${lanIp})...`);
  log('Emulator UI: http://localhost:4000   Ctrl+C to stop.');
  // The Firebase CLI shells out to `java` on PATH (not JAVA_HOME) for the Firestore/Auth
  // emulators, so make sure the resolved JDK's bin/ is actually on PATH for this step.
  const pathWithJava = javaHome
    ? `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH}`
    : process.env.PATH;
  run('npx', ['firebase', 'emulators:start', '--only', 'auth,firestore,functions'], { PATH: pathWithJava });
}

main();
