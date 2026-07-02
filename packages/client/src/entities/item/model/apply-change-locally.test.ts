import { expect, test } from 'vitest';
import type { Item, ItemChange } from '@kupi/shared';
import { applyChangeLocally } from './apply-change-locally';

const existing: Item = {
  id: 'item-1',
  listId: 'list-1',
  name: 'Молоко',
  quantity: 1,
  categoryId: null,
  checked: false,
  version: 5,
  deleted: false,
  updatedAt: 1000,
};

test('upsert on an unknown itemId prepends a new item', () => {
  const change: ItemChange = {
    itemId: 'item-2',
    clientOpId: 'op-1',
    op: 'upsert',
    fields: { name: 'Хлеб', quantity: 1, categoryId: null },
  };
  const result = applyChangeLocally([existing], change, 'list-1');
  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({ id: 'item-2', name: 'Хлеб', listId: 'list-1' });
  expect(result[1]).toEqual(existing);
});

test('upsert on a known itemId patches only the given fields', () => {
  const change: ItemChange = {
    itemId: 'item-1',
    clientOpId: 'op-1',
    op: 'upsert',
    fields: { checked: true },
  };
  const result = applyChangeLocally([existing], change, 'list-1');
  expect(result).toEqual([{ ...existing, checked: true, updatedAt: result[0]!.updatedAt }]);
});

test('delete removes the item by id', () => {
  const change: ItemChange = { itemId: 'item-1', clientOpId: 'op-1', op: 'delete', fields: {} };
  expect(applyChangeLocally([existing], change, 'list-1')).toEqual([]);
});

test('delete on an unknown itemId is a no-op', () => {
  const change: ItemChange = {
    itemId: 'does-not-exist',
    clientOpId: 'op-1',
    op: 'delete',
    fields: {},
  };
  expect(applyChangeLocally([existing], change, 'list-1')).toEqual([existing]);
});
