import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Kysely, SqliteDialect, sql } from 'kysely';
import type { Migration } from 'kysely/migration';

import { migrateToLatest } from '@/db/migrator';

test('a later migration alters schema without touching data from earlier ones', async () => {
  const db = new Kysely<any>({
    dialect: new SqliteDialect({ database: new Database(':memory:') }),
  });

  const step1: Record<string, Migration> = {
    '001-init': {
      async up(db) {
        await sql`CREATE TABLE widgets (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL)`.execute(
          db,
        );
      },
    },
  };
  await migrateToLatest(db, step1);
  await sql`INSERT INTO widgets (id, name) VALUES ('1', 'gizmo')`.execute(db);

  // Симулируем добавление новой миграции поверх уже применённой первой —
  // ровно тот сценарий, где раньше вручную правили schema.ts и получали
  // "table has no column" на существующей БД.
  const step2: Record<string, Migration> = {
    ...step1,
    '002-add-color': {
      async up(db) {
        await sql`ALTER TABLE widgets ADD COLUMN color TEXT`.execute(db);
      },
    },
  };
  await migrateToLatest(db, step2);

  const { rows } = await sql<{
    id: string;
    name: string;
    color: string | null;
  }>`SELECT * FROM widgets`.execute(db);
  assert.deepEqual(rows, [{ id: '1', name: 'gizmo', color: null }]);
});

test('re-running migrateToLatest with no new migrations is a no-op', async () => {
  const db = new Kysely<any>({
    dialect: new SqliteDialect({ database: new Database(':memory:') }),
  });
  const migrations: Record<string, Migration> = {
    '001-init': {
      async up(db) {
        await sql`CREATE TABLE widgets (id TEXT PRIMARY KEY NOT NULL)`.execute(
          db,
        );
      },
    },
  };

  await migrateToLatest(db, migrations);
  await migrateToLatest(db, migrations);

  const { rows } = await sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'widgets'`.execute(
    db,
  );
  assert.equal(rows.length, 1);
});
