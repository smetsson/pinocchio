// Make Homebrew's Java visible to the Firebase emulator (needed on macOS).
import { existsSync } from 'node:fs';

export function emulatorEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const dir of ['/opt/homebrew/opt/openjdk@21/bin', '/opt/homebrew/opt/openjdk/bin', '/usr/local/opt/openjdk/bin']) {
    if (existsSync(dir)) {
      env.PATH = `${dir}:${env.PATH}`;
      break;
    }
  }
  return env;
}
