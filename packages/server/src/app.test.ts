import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildApp } from '@/app';

test('GET /health returns ok', async () => {
  const sqlite = new Database(':memory:');
  const app = buildApp(sqlite);

  const res = await app.inject({ method: 'GET', url: '/health' });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: 'ok' });

  await app.close();
});
