import { sql, type Insertable, type Selectable, type Updateable } from 'kysely';

import type { Item, Suggestion } from '@kupi/shared';

import type { Db } from '@/db/connection';
import type { Items } from '@/db/types';
import { normalizeName } from '@/shared/ids';

function rowToItem(row: Selectable<Items>): Item {
  return {
    ...row,
    checked: Boolean(row.checked),
    deleted: Boolean(row.deleted),
  };
}

/** Регистрирует применённую операцию; возвращает false, если clientOpId уже был применён в этом списке. */
export async function insertAppliedOp(
  db: Db,
  listId: string,
  clientOpId: string,
): Promise<boolean> {
  const result = await db
    .insertInto('appliedOps')
    .values({ listId, clientOpId, createdAt: Date.now() })
    .onConflict((oc) => oc.doNothing())
    .executeTakeFirst();
  return Number(result.numInsertedOrUpdatedRows ?? 0) > 0;
}

/** Резолвит item по id в рамках списка (для проверки существования/tombstone-статуса). */
export async function findItemById(
  db: Db,
  listId: string,
  itemId: string,
): Promise<{ deleted: number } | undefined> {
  return db
    .selectFrom('items')
    .select('deleted')
    .where('listId', '=', listId)
    .where('id', '=', itemId)
    .executeTakeFirst();
}

/** Последняя известная категория для имени в списке (в т.ч. по удалённым items) — чтобы повторное добавление не сбрасывало категорию. */
export async function findLastCategoryIdForName(
  db: Db,
  listId: string,
  name: string,
): Promise<string | null> {
  const row = await db
    .selectFrom('items')
    .select('categoryId')
    .where('listId', '=', listId)
    .where(sql<boolean>`lower(name) = lower(${name})`)
    .where('categoryId', 'is not', null)
    .orderBy('version', 'desc')
    .limit(1)
    .executeTakeFirst();
  return row?.categoryId ?? null;
}

/** Вставляет новый item. */
export async function insertItem(
  db: Db,
  item: Insertable<Items>,
): Promise<void> {
  await db.insertInto('items').values(item).execute();
}

/** Помечает item удалённым (tombstone), не воскрешаемым обычной правкой. */
export async function tombstoneItem(
  db: Db,
  listId: string,
  itemId: string,
  version: number,
  updatedAt: number,
): Promise<void> {
  await db
    .updateTable('items')
    .set({ deleted: 1, version, updatedAt })
    .where('listId', '=', listId)
    .where('id', '=', itemId)
    .execute();
}

/** Column-wise патч: обновляет только присланные поля. */
export async function patchItem(
  db: Db,
  listId: string,
  itemId: string,
  patch: Updateable<Items>,
): Promise<void> {
  await db
    .updateTable('items')
    .set(patch)
    .where('listId', '=', listId)
    .where('id', '=', itemId)
    .execute();
}

/** Все items списка с version > lastSeenSeq (дельта-pull, включая tombstones). */
export async function findItemsSince(
  db: Db,
  listId: string,
  lastSeenSeq: number,
): Promise<Item[]> {
  const rows = await db
    .selectFrom('items')
    .selectAll()
    .where('listId', '=', listId)
    .where('version', '>', lastSeenSeq)
    .orderBy('version')
    .execute();
  return rows.map(rowToItem);
}

/** Инкрементирует частоту использования имени для подсказок. */
export async function incrementFrequency(
  db: Db,
  accountId: string,
  name: string,
): Promise<void> {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return;
  await db
    .insertInto('itemFrequency')
    .values({ accountId, normalizedName, count: 1 })
    .onConflict((oc) =>
      oc
        .columns(['accountId', 'normalizedName'])
        .doUpdateSet((eb) => ({ count: eb('itemFrequency.count', '+', 1) })),
    )
    .execute();
}

/** Наиболее часто используемые имена аккаунта по префиксу. */
export async function findSuggestions(
  db: Db,
  accountId: string,
  normalizedPrefix: string,
): Promise<Suggestion[]> {
  return db
    .selectFrom('itemFrequency')
    .select(['normalizedName as name', 'count'])
    .where('accountId', '=', accountId)
    .where('normalizedName', 'like', `${normalizedPrefix}%`)
    .orderBy('count', 'desc')
    .orderBy('normalizedName')
    .limit(10)
    .execute();
}
