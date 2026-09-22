import type { CapacitorConfig } from '@capacitor/cli';

// Mirrors capacitor.config.ts (the mechanic app's config) but for the admin
// app: separate appId so it installs as a distinct Android app with its own
// storage sandbox, and points at the admin build output (dist/admin) instead
// of the mechanic build (dist). See capacitor.config.ts for the CAP_LOCAL_DEV
// explanation.
const config: CapacitorConfig = {
  appId: 'com.agrisahaya.admin',
  appName: 'AgriSahayaAdmin',
  webDir: 'dist/admin',
  android: { path: 'android-admin' },
  ...(process.env.CAP_LOCAL_DEV === '1' ? { server: { cleartext: true, androidScheme: 'http' } } : {}),
};

export default config;
