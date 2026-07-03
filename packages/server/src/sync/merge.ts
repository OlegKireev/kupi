import type { Updateable } from 'kysely';

import type { ItemChange } from '@kupi/shared';

import type { Db } from '@/db/connection';
import type { Items } from '@/db/types';
import { incrementListSeq } from '@/lists/repository';
import {
  findItemById,
  findLastCategoryIdForName,
  incrementFrequency,
  insertAppliedOp,
  insertItem,
  patchItem,
  tombstoneItem,
} from '@/sync/repository';

/**
 * Применяет одно изменение к списку с семантикой LWW (last-write-wins).
 *
 * Гарантии:
 * - Идемпотентность: повторная доставка одного clientOpId в рамках списка игнорируется через applied_ops.
 * - Remove-wins: tombstone (deleted=1) не воскрешается non-delete изменением.
 * - Column-wise patch: апдейт затрагивает только присланные поля, так что
 *   конкурентные правки разных полей обе выживают.
 * - Frequency: инкрементируется только при создании нового именованного item.
 *
 * // ponytail: очистка категории (categoryId: null) трактуется как "без изменений",
 * // потому что "поле отсутствует" и "поле явно очищено" неразличимы в патче —
 * // очистка категории не MVP-фича. Добавить sentinel-значение если понадобится.
 */
export async function applyChange(
  db: Db,
  listId: string,
  accountId: string,
  change: ItemChange,
): Promise<void> {
  // Идемпотентность: повторная доставка одного clientOpId не применяется дважды
  const isNewOp = await insertAppliedOp(db, listId, change.clientOpId);
  if (!isNewOp) return;

  const existingItem = await findItemById(db, change.itemId);

  // Remove-wins: tombstone не воскрешаем правкой
  if (existingItem && existingItem.deleted && change.op !== 'delete') return;

  const seq = await incrementListSeq(db, listId);
  const now = Date.now();
  const fields = change.fields;

  if (!existingItem) {
    // Новый item — вставляем с дефолтами для не присланных полей.
    // Если категория не задана явно, подхватываем последнюю известную по
    // имени в списке — так удаление и повторное добавление того же
    // названия не сбрасывает категорию.
    const categoryId =
      fields.categoryId ??
      (fields.name
        ? await findLastCategoryIdForName(db, listId, fields.name)
        : null);
    await insertItem(db, {
      id: change.itemId,
      listId,
      name: fields.name ?? '',
      quantity: fields.quantity ?? 1,
      categoryId,
      checked: fields.checked ? 1 : 0,
      version: seq,
      deleted: change.op === 'delete' ? 1 : 0,
      updatedAt: now,
    });
    // Frequency инкрементируется только при создании нового именованного item
    if (change.op !== 'delete' && fields.name) {
      await incrementFrequency(db, accountId, fields.name);
    }
    return;
  }

  if (change.op === 'delete') {
    await tombstoneItem(db, change.itemId, seq, now);
    return;
  }

  // Патч: обновляем только присланные поля — конкурентные правки разных полей
  // обе выживают; конкурентные правки одного поля выигрывает последняя дошедшая до сервера.
  const patch: Updateable<Items> = { version: seq, updatedAt: now };
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.quantity !== undefined) patch.quantity = fields.quantity;
  if (fields.categoryId !== undefined) patch.categoryId = fields.categoryId;
  if (fields.checked !== undefined) patch.checked = fields.checked ? 1 : 0;
  await patchItem(db, change.itemId, patch);
}
