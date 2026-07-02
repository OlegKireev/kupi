import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Computed once at import time — playwright.config.ts and
// global-teardown.ts both import this module, so they agree on the same
// path without passing it through an env var.
export const tmpDbPath = path.join(tmpdir(), `kupi-e2e-${randomUUID()}.db`);
