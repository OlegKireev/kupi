import type { Db } from '@/db/connection';

/** Создаёт одноразовый код для связывания устройства с аккаунтом. */
export async function insertLinkCode(
  db: Db,
  params: { code: string; accountId: string; expiresAt: number },
): Promise<void> {
  await db.insertInto('linkCodes').values(params).execute();
}

/** Резолвит код связывания. */
export async function findLinkCodeByCode(
  db: Db,
  code: string,
): Promise<{ accountId: string; expiresAt: number } | undefined> {
  return db
    .selectFrom('linkCodes')
    .select(['accountId', 'expiresAt'])
    .where('code', '=', code)
    .executeTakeFirst();
}

/** Гашение кода связывания (одноразовый). */
export async function deleteLinkCode(db: Db, code: string): Promise<void> {
  await db.deleteFrom('linkCodes').where('code', '=', code).execute();
}
