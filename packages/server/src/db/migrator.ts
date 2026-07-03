import type { Kysely } from 'kysely';
import {
  type Migration,
  type MigrationProvider,
  Migrator,
} from 'kysely/migration';

import { migrations as productionMigrations } from '@/db/migrations';

class ObjectMigrationProvider implements MigrationProvider {
  constructor(private readonly migrations: Record<string, Migration>) {}

  async getMigrations(): Promise<Record<string, Migration>> {
    return this.migrations;
  }
}

/**
 * Применяет все ещё не применённые миграции (по имени, в алфавитном
 * порядке), отслеживая прогресс в таблице kysely_migration. В отличие от
 * старого `CREATE TABLE IF NOT EXISTS`-подхода, изменения существующих
 * таблиц (ALTER TABLE и т.п.) применяются на уже заполненной БД, а не
 * молча игнорируются.
 *
 * `migrations` параметризован (по умолчанию — реальный набор из
 * db/migrations) только для тестируемости раннера в изоляции.
 */
export async function migrateToLatest(
  db: Kysely<any>,
  migrations: Record<string, Migration> = productionMigrations,
): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new ObjectMigrationProvider(migrations),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((result) => {
    if (result.status === 'Error') {
      console.error(`migration "${result.migrationName}" failed`);
    }
  });

  if (error) {
    throw error;
  }
}
