import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildApp } from '@/app';

test('buildApp seeds the 9 preset categories', async () => {
  const sqlite = new Database(':memory:');
  await buildApp(sqlite);

  const row = sqlite.prepare('SELECT COUNT(*) AS n FROM categories').get() as {
    n: number;
  };
  assert.equal(row.n, 9);

  const other = sqlite
    .prepare("SELECT name FROM categories WHERE id = 'other'")
    .get() as {
    name: string;
  };
  assert.equal(other.name, 'Другое');
});

test('seedCategories is idempotent (buildApp twice keeps 9 categories)', async () => {
  const sqlite = new Database(':memory:');
  await buildApp(sqlite);
  await buildApp(sqlite);

  const row = sqlite.prepare('SELECT COUNT(*) AS n FROM categories').get() as {
    n: number;
  };
  assert.equal(row.n, 9);
});
