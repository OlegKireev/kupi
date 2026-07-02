import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { tmpDbPath } from './tests/tmp-db';

const repoRoot = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  testDir: './tests',
  globalTeardown: './global-teardown.ts',
  fullyParallel: true,
  // ponytail: one shared server + one shared SQLite file backs every test;
  // full worker concurrency thrashes both under load (flaky timeouts on
  // otherwise-deterministic assertions). Serialize until per-test isolation
  // is worth the complexity.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @kupi/server dev',
      url: 'http://localhost:3100/api/health',
      cwd: repoRoot,
      reuseExistingServer: false,
      env: { PORT: '3100', DB_PATH: tmpDbPath },
    },
    {
      command: 'pnpm --filter @kupi/client dev --port 5174',
      url: 'http://localhost:5174',
      cwd: repoRoot,
      reuseExistingServer: false,
      env: { VITE_API_PROXY_TARGET: 'http://localhost:3100' },
    },
  ],
});
