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

Node.js 20.19.4 or newer is recommended for Expo SDK 57.

```powershell
npm install
npm run typecheck
npm start
```

After `npm start`, scan the QR code with Expo Go.

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
