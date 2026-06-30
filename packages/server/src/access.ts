import type { Db } from "@/db";

/**
 * Проверяет, является ли пользователь членом списка.
 * Возвращает true, если запись найдена в list_members.
 */
export function isMember(db: Db, listId: string, accountId: string): boolean {
  return !!db
    .prepare("SELECT 1 FROM list_members WHERE list_id = ? AND account_id = ?")
    .get(listId, accountId);
}

/**
 * Проверяет, является ли пользователь владельцем списка.
 * Возвращает true, если в list_members найдена запись с role = 'owner'.
 */
export function isOwner(db: Db, listId: string, accountId: string): boolean {
  return !!db
    .prepare("SELECT 1 FROM list_members WHERE list_id = ? AND account_id = ? AND role = 'owner'")
    .get(listId, accountId);
}
