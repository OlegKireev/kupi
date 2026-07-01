import type { Account, Category } from '@kupi/shared';

import type { Db } from '@/db/connection';

/** Создаёт новый анонимный аккаунт. */
export async function insertAccount(db: Db, account: Account): Promise<void> {
  await db.insertInto('accounts').values(account).execute();
}

/** Резолвит аккаунт по id. */
export async function findAccountById(
  db: Db,
  accountId: string,
): Promise<Account | undefined> {
  return db
    .selectFrom('accounts')
    .selectAll()
    .where('id', '=', accountId)
    .executeTakeFirst();
}

/** Пресетный набор категорий, отсортированный для отображения. */
export async function findCategories(db: Db): Promise<Category[]> {
  return db.selectFrom('categories').selectAll().orderBy('sort').execute();
}
