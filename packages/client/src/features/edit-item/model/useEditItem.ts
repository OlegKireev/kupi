import type { Item, ItemChange } from '@kupi/shared';

import { generateId } from '@/shared/lib/ids';

interface Params {
  applyChange: (change: ItemChange) => void;
}

export function useEditItem({ applyChange }: Params) {
  const setQuantity = (item: Item, quantity: number) =>
    applyChange({
      clientOpId: generateId(),
      fields: { quantity },
      itemId: item.id,
      op: 'upsert',
    });

  const setCategory = (item: Item, categoryId: string | null) =>
    applyChange({
      clientOpId: generateId(),
      fields: { categoryId },
      itemId: item.id,
      op: 'upsert',
    });

  const deleteItem = (item: Item) =>
    applyChange({
      clientOpId: generateId(),
      fields: {},
      itemId: item.id,
      op: 'delete',
    });

  return { deleteItem, setCategory, setQuantity };
}
