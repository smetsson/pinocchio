/**
 * Deletes expired rooms (and their host keys) from the Realtime Database.
 * Runs daily from GitHub Actions. Locally: FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node scripts/cleanup.mjs
 */
import { readFileSync } from 'node:fs';
import admin from 'firebase-admin';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.log('ℹ️  FIREBASE_SERVICE_ACCOUNT secret not set: skipping clean-up. (Expired rooms are still unreadable.)');
  process.exit(0);
}

const config = readFileSync(new URL('../src/firebase-config.ts', import.meta.url), 'utf8');
const databaseURL = config.match(/databaseURL:\s*'([^']+)'/)?.[1];
if (!databaseURL || databaseURL.includes('your-project')) {
  console.error('❌ Could not find databaseURL in src/firebase-config.ts');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)), databaseURL });
const db = admin.database();
const now = Date.now();

const [index, rooms] = await Promise.all([db.ref('roomIndex').get(), db.ref('rooms').get()]);
const codes = new Set();
for (const [code, expiresAt] of Object.entries(index.val() ?? {})) if (expiresAt < now) codes.add(code);
// Also catch rooms missing from the index.
for (const [code, room] of Object.entries(rooms.val() ?? {})) if (!(room?.meta?.expiresAt > now)) codes.add(code);
// And orphaned host keys / claims.
for (const path of ['hostKeys', 'claims']) {
  const snap = await db.ref(path).get();
  for (const code of Object.keys(snap.val() ?? {})) if (!rooms.child(code).exists()) codes.add(code);
}

const updates = {};
for (const code of codes) {
  updates[`rooms/${code}`] = null;
  updates[`roomIndex/${code}`] = null;
  updates[`hostKeys/${code}`] = null;
  updates[`claims/${code}`] = null;
}
if (codes.size) await db.ref().update(updates);
console.log(`🧹 Deleted ${codes.size} expired room(s): ${[...codes].join(', ') || '-'}`);
await admin.app().delete();
