import type { List } from '@kupi/shared';

import type { Db } from '@/db/connection';

/** Все списки, в которых аккаунт состоит (owner или member), по дате создания. */
export async function findListsForAccount(
  db: Db,
  accountId: string,
): Promise<List[]> {
  return db
    .selectFrom('lists')
    .innerJoin('listMembers', 'listMembers.listId', 'lists.id')
    .selectAll('lists')
    .where('listMembers.accountId', '=', accountId)
    .orderBy('lists.createdAt')
    .execute();
}

/** Резолвит список по id. */
export async function findListById(
  db: Db,
  listId: string,
): Promise<List | undefined> {
  return db
    .selectFrom('lists')
    .selectAll()
    .where('id', '=', listId)
    .executeTakeFirst();
}

/** Создаёт новый список. */
export async function insertList(
  db: Db,
  params: {
    id: string;
    name: string;
    ownerAccountId: string;
    createdAt: number;
  },
): Promise<void> {
  await db.insertInto('lists').values(params).execute();
}

/** Обновляет имя списка. */
export async function updateListName(
  db: Db,
  listId: string,
  name: string,
): Promise<void> {
  await db
    .updateTable('lists')
    .set({ name })
    .where('id', '=', listId)
    .execute();
}

/** Инкрементирует seq списка и возвращает новое значение. */
export async function incrementListSeq(
  db: Db,
  listId: string,
): Promise<number> {
  const row = await db
    .updateTable('lists')
    .set((eb) => ({ seq: eb('seq', '+', 1) }))
    .where('id', '=', listId)
    .returning('seq')
    .executeTakeFirstOrThrow();
  return row.seq;
}

/** Добавляет аккаунт в список с заданной ролью (owner/member). */
export async function insertListMember(
  db: Db,
  params: { listId: string; accountId: string; role: 'owner' | 'member' },
): Promise<void> {
  await db
    .insertInto('listMembers')
    .values(params)
    .onConflict((oc) => oc.doNothing())
    .execute();
}

/** Проверяет, состоит ли аккаунт в списке. */
export async function isMember(
  db: Db,
  listId: string,
  accountId: string,
): Promise<boolean> {
  const row = await db
    .selectFrom('listMembers')
    .select('accountId')
    .where('listId', '=', listId)
    .where('accountId', '=', accountId)
    .executeTakeFirst();
  return Boolean(row);
}

/** Проверяет, является ли аккаунт владельцем списка. */
export async function isOwner(
  db: Db,
  listId: string,
  accountId: string,
): Promise<boolean> {
  const row = await db
    .selectFrom('listMembers')
    .select('accountId')
    .where('listId', '=', listId)
    .where('accountId', '=', accountId)
    .where('role', '=', 'owner')
    .executeTakeFirst();
  return Boolean(row);
}

/** Создаёт код приглашения в список. */
export async function insertListInvite(
  db: Db,
  params: { code: string; listId: string; expiresAt: number },
): Promise<void> {
  await db.insertInto('listInvites').values(params).execute();
}

/** Резолвит приглашение по коду. */
export async function findListInviteByCode(
  db: Db,
  code: string,
): Promise<{ listId: string; expiresAt: number } | undefined> {
  return db
    .selectFrom('listInvites')
    .select(['listId', 'expiresAt'])
    .where('code', '=', code)
    .executeTakeFirst();
}
