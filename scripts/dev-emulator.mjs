// Local development without a Firebase project: emulators + Vite dev server.
import { spawn } from 'node:child_process';
import { emulatorEnv } from './env.mjs';

const env = emulatorEnv({ VITE_EMULATOR: '1' });
const emu = spawn('npx', ['firebase', 'emulators:start', '--only', 'auth,database', '--project', 'demo-pinocchio'], { stdio: 'inherit', env });
const vite = spawn('npx', ['vite', '--host'], { stdio: 'inherit', env });
const stop = () => {
  emu.kill('SIGINT');
  vite.kill('SIGINT');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
emu.on('exit', () => vite.kill('SIGINT'));
