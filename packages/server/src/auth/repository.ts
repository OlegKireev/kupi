import type { Db } from '@/db/connection';

/** Резолвит device-токен в accountId; undefined, если токен не найден. */
export async function findDeviceByToken(
  db: Db,
  token: string,
): Promise<{ accountId: string } | undefined> {
  return db
    .selectFrom('devices')
    .select('accountId')
    .where('token', '=', token)
    .executeTakeFirst();
}

/** Создаёт новое устройство с токеном, привязанное к аккаунту. */
export async function insertDevice(
  db: Db,
  params: { id: string; accountId: string; token: string; createdAt: number },
): Promise<void> {
  await db.insertInto('devices').values(params).execute();
}
