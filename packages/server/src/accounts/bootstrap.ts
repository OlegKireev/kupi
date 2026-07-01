import type { Bootstrap } from '@kupi/shared';

import { findAccountById, findCategories } from '@/accounts/repository';
import type { Db } from '@/db/connection';
import { findListsForAccount } from '@/lists/repository';

/**
 * Собирает payload для свежеаутентифицированного устройства:
 * его аккаунт, все списки в которых оно состоит, пресет категорий.
 * Переиспользуется в POST /accounts и в POST /link.
 */
export async function buildBootstrap(
  db: Db,
  accountId: string,
): Promise<Bootstrap> {
  const account = await findAccountById(db, accountId);
  const lists = await findListsForAccount(db, accountId);
  const categories = await findCategories(db);

  return { account: account!, lists, categories };
}
