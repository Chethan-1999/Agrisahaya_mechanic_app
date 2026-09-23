import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Production build of the admin app, separate from vite.config.ts (mechanic) so
// dist/admin/ is self-contained: its own index.html AND its own assets/. The
// admin native app (capacitor.admin.config.ts) uses dist/admin as its webDir,
// and Capacitor copies only that folder — with one shared build the admin page
// pointed at ../assets/ outside it and rendered blank.
//
// base './' keeps asset URLs relative, so the same output works both from the
// Capacitor webview root and when hosted under /admin/ on the web.
// The dev server doesn't use this file: `npm run dev` (vite.config.ts) already
// serves admin/index.html at /admin/.
export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'admin'),
  envDir: __dirname, // root moved to admin/, but .env lives at the repo root
  publicDir: false, // public/ holds mechanic-site pages (privacy policy etc.)
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist/admin'),
    emptyOutDir: true,
  },
});
