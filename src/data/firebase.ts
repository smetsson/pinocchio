import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  signInAnonymously,
  type Auth,
} from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';
import { firebaseConfig } from '../firebase-config';

/** True when running against the local Firebase emulator (npm run dev:emu / tests). */
export const USE_EMULATOR = import.meta.env.VITE_EMULATOR === '1';

const EMULATOR_CONFIG = {
  apiKey: 'demo-key',
  authDomain: 'demo-pinocchio.firebaseapp.com',
  databaseURL: 'http://127.0.0.1:9000?ns=demo-pinocchio-default-rtdb',
  projectId: 'demo-pinocchio',
  appId: 'demo',
};

export function isConfigured(): boolean {
  return USE_EMULATOR || !firebaseConfig.apiKey.startsWith('PASTE');
}

export interface Fb {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
  uid: string;
}

function emulatorHost(): string {
  // Use the same host as the page so phones on the local network can reach the emulator.
  const h = typeof location !== 'undefined' ? location.hostname : '';
  return !h || h === 'localhost' ? '127.0.0.1' : h;
}

async function connect(app: FirebaseApp, auth: Auth): Promise<Fb> {
  const db = getDatabase(app);
  if (USE_EMULATOR) {
    connectDatabaseEmulator(db, emulatorHost(), 9000);
    connectAuthEmulator(auth, `http://${emulatorHost()}:9099`, { disableWarnings: true });
  }
  await auth.authStateReady();
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  return { app, auth, db, uid: user.uid };
}

let main: Promise<Fb> | null = null;

/** The phone's own Firebase connection (anonymous user persisted in the browser). */
export function getFb(): Promise<Fb> {
  if (!main) {
    const app = initializeApp(USE_EMULATOR ? EMULATOR_CONFIG : firebaseConfig);
    main = connect(app, getAuth(app));
  }
  return main;
}

/** A separate connection with its own anonymous user (used by the bots). */
export async function makeBotFb(name: string): Promise<Fb> {
  const app = initializeApp(USE_EMULATOR ? EMULATOR_CONFIG : firebaseConfig, name);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  return connect(app, auth);
}

export async function closeFb(fb: Fb): Promise<void> {
  await deleteApp(fb.app);
}
