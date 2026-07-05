import type { Item, ItemChange } from '@kupi/shared';

export function applyChangeLocally(
  items: Item[],
  change: ItemChange,
  listId: string,
): Item[] {
  const index = items.findIndex((item) => item.id === change.itemId);

  if (change.op === 'delete') {
    return index === -1
      ? items
      : items.filter((item) => item.id !== change.itemId);
  }

  if (index === -1) {
    const newItem: Item = {
      categoryId: change.fields.categoryId ?? null,
      checked: change.fields.checked ?? false,
      deleted: false,
      id: change.itemId,
      listId,
      name: change.fields.name ?? '',
      quantity: change.fields.quantity ?? 1,
      updatedAt: Date.now(),
      version: 0,
    };
    return [newItem, ...items];
  }

  return items.map((item, i) =>
    i === index ? { ...item, ...change.fields, updatedAt: Date.now() } : item,
  );
}
