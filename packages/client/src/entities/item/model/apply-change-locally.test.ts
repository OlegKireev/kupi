import type { Item, ItemChange } from '@kupi/shared';

import { describe, expect, it } from 'vitest';

import { applyChangeLocally } from './apply-change-locally';

const existing: Item = {
  categoryId: null,
  checked: false,
  deleted: false,
  id: 'item-1',
  listId: 'list-1',
  name: 'Молоко',
  quantity: 1,
  updatedAt: 1000,
  version: 5,
};

describe('applyChangeLocally()', () => {
  it('upsert on an unknown itemId prepends a new item', () => {
    const change: ItemChange = {
      clientOpId: 'op-1',
      fields: { categoryId: null, name: 'Хлеб', quantity: 1 },
      itemId: 'item-2',
      op: 'upsert',
    };
    const result = applyChangeLocally([existing], change, 'list-1');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'item-2',
      listId: 'list-1',
      name: 'Хлеб',
    });
    expect(result[1]).toStrictEqual(existing);
  });

  it('upsert on a known itemId patches only the given fields', () => {
    const change: ItemChange = {
      clientOpId: 'op-1',
      fields: { checked: true },
      itemId: 'item-1',
      op: 'upsert',
    };
    const result = applyChangeLocally([existing], change, 'list-1');
    expect(result).toStrictEqual([
      { ...existing, checked: true, updatedAt: result[0]?.updatedAt },
    ]);
  });

  it('delete removes the item by id', () => {
    const change: ItemChange = {
      clientOpId: 'op-1',
      fields: {},
      itemId: 'item-1',
      op: 'delete',
    };
    expect(applyChangeLocally([existing], change, 'list-1')).toStrictEqual([]);
  });

  it('delete on an unknown itemId is a no-op', () => {
    const change: ItemChange = {
      clientOpId: 'op-1',
      fields: {},
      itemId: 'does-not-exist',
      op: 'delete',
    };
    expect(applyChangeLocally([existing], change, 'list-1')).toStrictEqual([
      existing,
    ]);
  });
});
