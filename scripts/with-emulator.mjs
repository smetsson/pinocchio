// Runs a command while the Firebase emulators (auth + database) are running.
// Usage: node scripts/with-emulator.mjs "vitest run"
import { spawnSync } from 'node:child_process';
import { emulatorEnv } from './env.mjs';

const cmd = process.argv.slice(2).join(' ');
spawnSync('node', ['scripts/build-rules.mjs'], { stdio: 'inherit' });
const r = spawnSync('npx', ['firebase', 'emulators:exec', '--only', 'auth,database', '--project', 'demo-pinocchio', cmd], {
  stdio: 'inherit',
  env: emulatorEnv({ VITE_EMULATOR: '1' }),
});
process.exit(r.status ?? 1);
