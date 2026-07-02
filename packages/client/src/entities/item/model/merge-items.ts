import type { Item } from '@kupi/shared';

export function mergeItems(current: Item[], incoming: Item[]): Item[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return [...byId.values()].filter((item) => !item.deleted);
}
