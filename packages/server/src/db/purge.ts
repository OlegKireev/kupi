import type { Db } from '@/db/connection';

// 30 дней: applied_ops нужны только для дедупа повторной доставки в коротком
// офлайн-окне; tombstones должны пережить это окно, чтобы другие клиенты
// успели забрать удаление, но не обязаны храниться вечно.
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Чистит монотонно растущие таблицы: applied_ops (идемпотентность sync) и
 * tombstoned items (deleted=1) старше RETENTION_MS. item_frequency сюда не
 * входит — она не растёт с каждой операцией, а ограничена числом уникальных
 * названий товаров аккаунта, так что осмысленного порога устаревания для неё нет.
 */
export async function purgeStaleData(
  db: Db,
  now: number = Date.now(),
): Promise<void> {
  const cutoff = now - RETENTION_MS;
  await db.deleteFrom('appliedOps').where('createdAt', '<', cutoff).execute();
  await db
    .deleteFrom('items')
    .where('deleted', '=', 1)
    .where('updatedAt', '<', cutoff)
    .execute();
}
