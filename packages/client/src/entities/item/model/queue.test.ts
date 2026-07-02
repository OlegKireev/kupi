import { expect, test } from 'vitest';

import type { ItemChange } from '@kupi/shared';

import { enqueue, markAttempted } from './queue';

const change: ItemChange = {
  itemId: 'item-1',
  clientOpId: 'op-1',
  op: 'upsert',
  fields: { checked: true },
};

test('enqueue appends a change with zero attempts', () => {
  const queue = enqueue([], change);
  expect(queue).toEqual([{ change, attempts: 0, failed: false }]);
});

test('markAttempted increments attempts on every entry', () => {
  const queue = enqueue([], change);
  const next = markAttempted(queue);
  expect(next[0]).toEqual({ change, attempts: 1, failed: false });
});

test('markAttempted marks an entry failed after 3 attempts', () => {
  let queue = enqueue([], change);
  queue = markAttempted(queue);
  queue = markAttempted(queue);
  queue = markAttempted(queue);
  expect(queue[0]).toEqual({ change, attempts: 3, failed: true });
});

test('markAttempted keeps a failed entry failed on further attempts', () => {
  let queue = [{ change, attempts: 3, failed: true }];
  queue = markAttempted(queue);
  expect(queue[0]).toEqual({ change, attempts: 4, failed: true });
});
