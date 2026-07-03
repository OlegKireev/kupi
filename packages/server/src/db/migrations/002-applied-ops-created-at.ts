import { type Kysely, sql } from 'kysely';

// created_at нужен для purge sweep (db/purge.ts) — без него applied_ops не
// с чем сравнить по возрасту. Существующие строки получают 0 (эпоха) — при
// первом sweep они считаются старыми и удаляются, это безопасно: строка
// applied_ops нужна только для дедупа повторной доставки одного и того же
// clientOpId, что имеет смысл лишь в коротком окне после исходной операции.
export async function up(db: Kysely<any>): Promise<void> {
  await sql
    .raw(
      `ALTER TABLE applied_ops ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0`,
    )
    .execute(db);
}
