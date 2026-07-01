import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import {
  generate,
  SqliteDialect as CodegenSqliteDialect,
} from 'kysely-codegen';

import { initSchema } from '@/db/schema';

/**
 * db/types.ts не редактируется руками: это генерируемый снимок реальной
 * схемы (db/schema.ts), снятый через kysely-codegen. Так поля в Kysely-типах
 * и в DDL физически не могут разойтись — типы всегда отражают то, что
 * initSchema реально создаёт в SQLite.
 *
 * Запуск: pnpm --filter @kupi/server db:generate-types (после правки schema.ts)
 * Проверка без записи: pnpm --filter @kupi/server db:verify-types (используется в pretest)
 */
async function main(): Promise<void> {
  const sqlite = new Database(':memory:');
  initSchema(sqlite);
  const db = new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });

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
