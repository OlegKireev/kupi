import type { ItemChange } from '@kupi/shared';

export type QueuedChange = {
  change: ItemChange;
  attempts: number;
  failed: boolean;
};

const MAX_ATTEMPTS = 3;

export function enqueue(queue: QueuedChange[], change: ItemChange): QueuedChange[] {
  return [...queue, { change, attempts: 0, failed: false }];
}

export function markAttempted(queue: QueuedChange[]): QueuedChange[] {
  return queue.map((q) => {
    const attempts = q.attempts + 1;
    return { ...q, attempts, failed: q.failed || attempts >= MAX_ATTEMPTS };
  });
}
