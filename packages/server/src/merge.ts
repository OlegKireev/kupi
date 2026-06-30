import type { ItemChange } from "@kupi/shared";
import type { Db } from "@/db";
import { normalizeName } from "@/ids";

/** Инкрементирует счётчик списка и возвращает новый seq. */
function bumpSeq(db: Db, listId: string): number {
  db.prepare("UPDATE lists SET seq = seq + 1 WHERE id = ?").run(listId);
  return (db.prepare("SELECT seq FROM lists WHERE id = ?").get(listId) as { seq: number }).seq;
}

/** Инкрементирует частоту использования имени для подсказок. */
function incFreq(db: Db, accountId: string, name: string): void {
  const n = normalizeName(name);
  if (!n) return;
  db.prepare(
    `INSERT INTO item_frequency (account_id, normalized_name, count) VALUES (?, ?, 1)
     ON CONFLICT(account_id, normalized_name) DO UPDATE SET count = count + 1`,
  ).run(accountId, n);
}

/**
 * Применяет одно изменение к списку с семантикой LWW (last-write-wins).
 *
 * Гарантии:
 * - Идемпотентность: повторная доставка одного clientOpId игнорируется через applied_ops.
 * - Remove-wins: tombstone (deleted=1) не воскрешается non-delete изменением.
 * - Column-wise patch: upsert патчит только присланные поля через COALESCE,
 *   так что конкурентные правки разных полей обе выживают.
 * - Frequency: инкрементируется только при создании нового именованного item.
 *
 * // ponytail: очистка категории (categoryId: null) трактуется как "без изменений",
 * // потому что COALESCE не отличает "отсутствует" от "явный null" — очистка
 * // категории не MVP-фича. Добавить sentinel-значение если понадобится.
 */
export function applyChange(db: Db, listId: string, accountId: string, ch: ItemChange): void {
  // Идемпотентность: повторная доставка одного clientOpId не применяется дважды
  const ins = db
    .prepare("INSERT OR IGNORE INTO applied_ops (client_op_id) VALUES (?)")
    .run(ch.clientOpId);
  if (ins.changes === 0) return;

  const cur = db.prepare("SELECT deleted FROM items WHERE id = ?").get(ch.itemId) as
    | { deleted: number }
    | undefined;

  // Remove-wins: tombstone не воскрешаем правкой
  if (cur && cur.deleted && ch.op !== "delete") return;

  const seq = bumpSeq(db, listId);
  const now = Date.now();
  const f = ch.fields;

  if (!cur) {
    // Новый item — вставляем с дефолтами для не присланных полей
    db.prepare(
      `INSERT INTO items (id, list_id, name, quantity, category_id, checked, version, deleted, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      ch.itemId,
      listId,
      f.name ?? "",
      f.quantity ?? 1,
      f.categoryId ?? null,
      f.checked ? 1 : 0,
      seq,
      ch.op === "delete" ? 1 : 0,
      now,
    );
    // Frequency инкрементируется только при создании нового именованного item
    if (ch.op !== "delete" && f.name) incFreq(db, accountId, f.name);
    return;
  }

  if (ch.op === "delete") {
    db.prepare("UPDATE items SET deleted = 1, version = ?, updated_at = ? WHERE id = ?").run(
      seq,
      now,
      ch.itemId,
    );
    return;
  }

  // Patch: COALESCE(@x, col) — null (поле не прислано) оставляет текущее значение.
  // Конкурентные правки разных полей обе выживают; конкурентные правки одного поля
  // выигрывает последняя дошедшая до сервера.
  db.prepare(
    `UPDATE items SET
       name = COALESCE(@name, name),
       quantity = COALESCE(@quantity, quantity),
       category_id = COALESCE(@category_id, category_id),
       checked = COALESCE(@checked, checked),
       version = @seq, updated_at = @now
     WHERE id = @id`,
  ).run({
    name: f.name ?? null,
    quantity: f.quantity ?? null,
    category_id: f.categoryId ?? null,
    checked: f.checked === undefined ? null : f.checked ? 1 : 0,
    seq,
    now,
    id: ch.itemId,
  });
}
