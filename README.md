# Mechanic Directory

Modern Expo mobile app for maintaining a centralized database of mechanics across villages and districts.

## Stack

- Expo + React Native
- TypeScript
- Firebase Authentication for admin login
- Cloud Firestore for mechanic records and admin profiles

## Features

- Landing page with Mechanic Login and Admin Login
- Mechanic Login and Sign Up tabs
- Single-page mechanic registration with OTP verification gate
- Mechanic dashboard, profile, edit profile, and logout
- Admin email/password login
- Admin dashboard cards for total, active, and inactive mechanics
- Admin navigation for Dashboard, Mechanics, Settings, and Logout
- Searchable mechanics list with district, village, and status filters
- View, edit, and delete mechanic records
- Green and white Material-style UI with dark mode
- Loading indicators, success messages, and delete confirmation dialog

## Run Locally

Node.js 22 or newer is required (`@capacitor/cli` requires Node >=22). An `.nvmrc` is provided — run `nvm use` if you use nvm.

```powershell
npm install
npm run typecheck
npm start
```

After `npm start`, scan the QR code with Expo Go.

## Run With Docker

To avoid "works on my machine" issues from differing local Node/npm versions, you can run the web dev server in Docker instead of installing Node locally:

```powershell
docker compose up --build
```

This builds the image on `node:22-alpine`, installs dependencies inside the container (so native modules match the container's platform, not your host's), and serves the Vite dev server at http://localhost:5173.

## Android App (Capacitor)

This repo also ships a Capacitor wrapper so the web app can run as a native Android app.

```powershell
npm run build
npx cap sync android
npx cap open android
```

The `android/` folder is generated (gitignored) rather than committed — run `npx cap add android` once if it doesn't exist yet, then `npx cap sync android` after every `npm run build` to refresh the bundled web assets. From Android Studio, build/run as usual, or from the `android/` folder run `./gradlew assembleDebug` for a debug APK.

## Test Against Local Firebase (LAN)

To test on a device/emulator without touching production Firebase, run everything against a Firebase Emulator Suite hosted on your own laptop:

```powershell
npm run dev:local
```

(`make local` does the same thing on macOS/Linux.) This one command, identical on macOS and Windows since it's plain Node.js:

1. Detects this laptop's LAN IPv4 address.
2. Builds the web app with that IP baked in as the Firebase host, and syncs it into the Android project (cleartext HTTP + `androidScheme: 'http'` are enabled only for this build — Capacitor normally serves the app from a synthetic `https://localhost` origin, and the WebView's Mixed Content policy silently blocks plain-HTTP calls to the emulators unless the app's own origin is HTTP too).
3. Boots the Android emulator (`Pixel_6` by default, override with `AVD_NAME=...`) if nothing is already connected, installs the debug APK, and launches the app.
4. Builds Cloud Functions and starts the Firebase Emulator Suite (Auth, Firestore, Functions) bound to `0.0.0.0`, so any device on the same Wi-Fi — not just this laptop — can reach it. Emulator UI: http://localhost:4000. Ctrl+C stops it.

Requires `ANDROID_HOME` (or the default SDK path) and a JDK — same as the "Android App" section above. If a device on Wi-Fi still can't connect, check your OS firewall allows inbound connections on ports 8080, 9099, 5001, and 4000.

## Firebase Setup

Your Firebase app config lives in `src/firebase.ts`.

Enable these Firebase products:

1. Authentication
2. Firestore Database

For admin login, create an admin user in Firebase Authentication, then create an `admins` document where the document id equals the Firebase Auth user uid:

```json
{
  "name": "Admin",
  "email": "admin@example.com",
  "role": "admin"
}
```

Mechanic records are stored in the `mechanics` collection with these fields:

```json
{
  "fullName": "",
  "phoneNumber": "",
  "village": "",
  "district": "",
  "state": "",
  "pincode": "",
  "address": "",
  "age": "",
  "experience": "",
  "isActive": true,
  "createdAt": "",
  "updatedAt": ""
}
```

## OTP Note

The current Expo Go implementation uses an in-app development OTP shown in an alert. For production SMS OTP on Android, use Firebase Phone Authentication through a native-capable setup such as Expo Development Build or React Native Firebase.

## Play Store Path

For Play Store publishing, use Expo Application Services:

```powershell
npm install --global eas-cli
eas login
eas build:configure
eas build --platform android
```

The Play Store upload file is an Android App Bundle (`.aab`) from EAS Build.
# crosssell-service
