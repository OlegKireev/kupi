import type { Item, ItemChange } from '@kupi/shared';

import { generateId } from '@/shared/lib/ids';

type Params = {
  applyChange: (change: ItemChange) => void;
};

export function useToggleItem({ applyChange }: Params) {
  return function toggle(item: Item): void {
    applyChange({
      itemId: item.id,
      clientOpId: generateId(),
      op: 'upsert',
      fields: { checked: !item.checked },
    });
  };
}
