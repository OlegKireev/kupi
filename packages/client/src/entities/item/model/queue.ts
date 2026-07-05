import type { ItemChange } from '@kupi/shared';

export interface QueuedChange {
  change: ItemChange;
  attempts: number;
  failed: boolean;
}

const MAX_ATTEMPTS = 3;

export function enqueue(
  queue: QueuedChange[],
  change: ItemChange,
): QueuedChange[] {
  return [...queue, { attempts: 0, change, failed: false }];
}

export function markAttempted(queue: QueuedChange[]): QueuedChange[] {
  return queue.map((queueChange) => {
    const attempts = queueChange.attempts + 1;
    return {
      ...queueChange,
      attempts,
      failed: queueChange.failed || attempts >= MAX_ATTEMPTS,
    };
  });
}

/** После сетевой ошибки уже упавшие правки остаются failed как есть,
 * остальные получают ещё одну попытку (см. markAttempted). */
export function requeueAfterError(queue: QueuedChange[]): QueuedChange[] {
  const failed = queue.filter((queueChange) => queueChange.failed);
  const attempted = markAttempted(
    queue.filter((queueChange) => !queueChange.failed),
  );
  return [...failed, ...attempted];
}
