import type { Item, ItemChange } from '@kupi/shared';

import { generateId } from '@/shared/lib/ids';

interface Params {
  applyChange: (change: ItemChange) => void;
}

export function useToggleItem({ applyChange }: Params) {
  return function toggle(item: Item): void {
    applyChange({
      clientOpId: generateId(),
      fields: { checked: !item.checked },
      itemId: item.id,
      op: 'upsert',
    });
  };
}
