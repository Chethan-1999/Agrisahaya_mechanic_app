/**
 * One-off local script to provision the first admin account.
 *
 * There is no in-app bootstrap path anymore — firestore.rules denies every
 * client write to /admins, on purpose (see Blueprint §10). This script uses
 * the Admin SDK directly, so it must be run locally by someone holding a
 * service account key, not deployed as a Cloud Function.
 *
 * Usage (from the functions/ directory):
 *   1. cp .env.scripts.example .env.scripts, fill in GOOGLE_APPLICATION_CREDENTIALS,
 *      OR pass it inline for a one-off run:
 *        GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *          npm run create-admin -- "admin@example.com" "a-strong-password" "Admin Name"
 */
import path from 'node:path';

import { config } from 'dotenv';

// NOT functions/.env: `firebase deploy` uploads that file as the deployed functions' environment, and a
// GOOGLE_APPLICATION_CREDENTIALS pointing at a laptop path makes every function crash on startup.
config({ path: path.resolve(__dirname, '../.env.scripts') });

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password || !name) {
    console.error('Usage: npm run create-admin -- <email> <password> <name>');
    process.exit(1);
  }

  const app = initializeApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  const userRecord = await auth.createUser({ email, password, displayName: name });

  await db.collection('admins').doc(userRecord.uid).set({
    name,
    email,
    role: 'admin',
  });

  console.log(`Admin created: ${email} (uid: ${userRecord.uid})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
