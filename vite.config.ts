import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Mechanic app build (dist/). The admin app builds separately into dist/admin/
// via vite.admin.config.ts — see that file for why. The dev server still serves
// both: admin/index.html is available at /admin/.
export default defineConfig({
  plugins: [react()],
  // SETTING_* (business settings for local testing — functions/src/shared/settings.ts) reach the app next to VITE_*.
  envPrefix: ['VITE_', 'SETTING_'],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
});
