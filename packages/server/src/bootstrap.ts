import type { Bootstrap } from "@kupi/shared";
import type { Db } from "@/db";
import { rowToAccount, rowToCategory, rowToList } from "@/map";

/**
 * Собирает payload для свежеаутентифицированного устройства:
 * его аккаунт, все списки в которых оно состоит, пресет категорий.
 * Переиспользуется в POST /accounts и в Task 5 (link).
 */
export function buildBootstrap(db: Db, accountId: string): Bootstrap {
  // Резолвим аккаунт
  const account = rowToAccount(
    db.prepare("SELECT * FROM accounts WHERE id = ?").get(accountId) as any,
  );

  // Резолвим все списки, где аккаунт — member или owner
  const lists = (
    db
      .prepare(
        `SELECT l.* FROM lists l
         JOIN list_members m ON m.list_id = l.id
         WHERE m.account_id = ?
         ORDER BY l.created_at`,
      )
      .all(accountId) as any[]
  ).map(rowToList);

  // Загружаем пресетные категории
  const categories = (db.prepare("SELECT * FROM categories ORDER BY sort").all() as any[]).map(
    rowToCategory,
  );

  return { account, lists, categories };
}
