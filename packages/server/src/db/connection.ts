import Database from 'better-sqlite3';
import { CamelCasePlugin, Kysely, SqliteDialect } from 'kysely';

import type { DB } from '@/db/types';

/** Открывает файловую (или in-memory) БД с нужными pragma. */
export function openSqlite(path = 'kupi.db'): Database.Database {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return sqlite;
}

/** Оборачивает открытую better-sqlite3 БД в typesafe Kysely query builder. */
export function createDb(sqlite: Database.Database): Db {
  return new Kysely<DB>({
    dialect: new SqliteDialect({ database: sqlite }),
    plugins: [new CamelCasePlugin()],
  });
}

export type Db = Kysely<DB>;
