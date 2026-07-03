import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import {
  generate,
  SqliteDialect as CodegenSqliteDialect,
} from 'kysely-codegen';

import { migrateToLatest } from '@/db/migrator';

/**
 * db/types.ts не редактируется руками: это генерируемый снимок реальной
 * схемы (db/migrations/), снятый через kysely-codegen. Так поля в
 * Kysely-типах и в DDL физически не могут разойтись — типы всегда отражают
 * то, что миграции реально создают в SQLite.
 *
 * Запуск: pnpm --filter @kupi/server db:generate-types (после добавления
 * миграции в db/migrations/)
 * Проверка без записи: pnpm --filter @kupi/server db:verify-types (используется в pretest)
 */
async function main(): Promise<void> {
  const sqlite = new Database(':memory:');
  const db = new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });
  await migrateToLatest(db);

  await generate({
    db,
    dialect: new CodegenSqliteDialect(),
    camelCase: true,
    outFile: new URL('../src/db/types.ts', import.meta.url).pathname,
    verify: process.argv.includes('--verify'),
  });

  sqlite.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
