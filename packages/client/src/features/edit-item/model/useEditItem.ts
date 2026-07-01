import type { Item, ItemChange, SyncResponse } from '@kupi/shared';
import { syncItems } from '@/entities/item';
import { generateId } from '@/shared/lib/ids';

type Params = {
  listId: string;
  lastSeenSeq: number;
  onSynced: (response: SyncResponse) => void;
};

export function useEditItem({ listId, lastSeenSeq, onSynced }: Params) {
  const apply = async (change: ItemChange): Promise<void> => {
    const response = await syncItems(listId, { lastSeenSeq, changes: [change] });
    onSynced(response);
  };

  const setQuantity = (item: Item, quantity: number) =>
    apply({ itemId: item.id, clientOpId: generateId(), op: 'upsert', fields: { quantity } });

  const setCategory = (item: Item, categoryId: string) =>
    apply({
      itemId: item.id,
      clientOpId: generateId(),
      op: 'upsert',
      fields: { categoryId },
    });

  const deleteItem = (item: Item) =>
    apply({ itemId: item.id, clientOpId: generateId(), op: 'delete', fields: {} });

  return { setQuantity, setCategory, deleteItem };
}
