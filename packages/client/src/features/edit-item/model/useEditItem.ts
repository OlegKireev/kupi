import type { Item, ItemChange } from '@kupi/shared';
import { generateId } from '@/shared/lib/ids';

type Params = {
  applyChange: (change: ItemChange) => void;
};

export function useEditItem({ applyChange }: Params) {
  const setQuantity = (item: Item, quantity: number) =>
    applyChange({ itemId: item.id, clientOpId: generateId(), op: 'upsert', fields: { quantity } });

  const setCategory = (item: Item, categoryId: string) =>
    applyChange({
      itemId: item.id,
      clientOpId: generateId(),
      op: 'upsert',
      fields: { categoryId },
    });

  const deleteItem = (item: Item) =>
    applyChange({ itemId: item.id, clientOpId: generateId(), op: 'delete', fields: {} });

  return { setQuantity, setCategory, deleteItem };
}
