import type { ItemChange } from '@kupi/shared';

import { describe, expect, it } from 'vitest';

import { enqueue, markAttempted } from './queue';

const change: ItemChange = {
  clientOpId: 'op-1',
  fields: { checked: true },
  itemId: 'item-1',
  op: 'upsert',
};

describe('queue', () => {
  it('enqueue appends a change with zero attempts', () => {
    const queue = enqueue([], change);
    expect(queue).toStrictEqual([{ attempts: 0, change, failed: false }]);
  });

  it('markAttempted increments attempts on every entry', () => {
    const queue = enqueue([], change);
    const next = markAttempted(queue);
    expect(next[0]).toStrictEqual({ attempts: 1, change, failed: false });
  });

  it('markAttempted marks an entry failed after 3 attempts', () => {
    let queue = enqueue([], change);
    queue = markAttempted(queue);
    queue = markAttempted(queue);
    queue = markAttempted(queue);
    expect(queue[0]).toStrictEqual({ attempts: 3, change, failed: true });
  });

  it('markAttempted keeps a failed entry failed on further attempts', () => {
    let queue = [{ attempts: 3, change, failed: true }];
    queue = markAttempted(queue);
    expect(queue[0]).toStrictEqual({ attempts: 4, change, failed: true });
  });
});
