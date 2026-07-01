import type { Item, SyncResponse } from '@kupi/shared';
import { syncItems } from '@/entities/item';
import { generateId } from '@/shared/lib/ids';

type Params = {
  listId: string;
  lastSeenSeq: number;
  onSynced: (response: SyncResponse) => void;
};

export function useToggleItem({ listId, lastSeenSeq, onSynced }: Params) {
  return async function toggle(item: Item): Promise<void> {
    const response = await syncItems(listId, {
      lastSeenSeq,
      changes: [
        {
          itemId: item.id,
          clientOpId: generateId(),
          op: 'upsert',
          fields: { checked: !item.checked },
        },
      ],
    });
    onSynced(response);
  };
}
