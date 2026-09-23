import type { CapacitorConfig } from '@capacitor/cli';
import adminConfig from './capacitor.admin.config';

// CAP_LOCAL_DEV is set only by `npm run dev:local` (scripts/local-dev.mjs), which
// points the app at this laptop's Firebase Emulator Suite over plain HTTP. Both
// settings below stay off for every normal build, including production:
//  - cleartext: lets Android's network layer open plain HTTP sockets at all.
//  - androidScheme 'http': Capacitor normally serves the app from a synthetic
//    https://localhost origin. With the app on HTTPS, the WebView's Mixed Content
//    policy silently blocks every plain-HTTP request to the emulators (Auth's iframe,
//    Firestore, Functions) regardless of the cleartext manifest flag — the page and
//    the emulator have to share a scheme.
const config: CapacitorConfig = {
  appId: 'com.agrisahaya.mechanic',
  appName: 'MechanicApp',
  webDir: 'dist',
  ...(process.env.CAP_LOCAL_DEV === '1' ? { server: { cleartext: true, androidScheme: 'http' } } : {}),
};

// The Capacitor CLI has no --config flag — it always loads this file. CAP_APP=admin
// swaps in the admin app's config (capacitor.admin.config.ts), so every admin
// `cap` command is `CAP_APP=admin npx cap <cmd> android`.
export default process.env.CAP_APP === 'admin' ? adminConfig : config;
