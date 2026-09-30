import { defineConfig, devices } from '@playwright/test';

// Run with: npm run test:e2e (starts the Firebase emulator + a dev server).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    // Screens change under the test's feet; don't wait forever for an element that just disappeared.
    actionTimeout: 5_000,
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    env: { VITE_EMULATOR: '1' },
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
});
