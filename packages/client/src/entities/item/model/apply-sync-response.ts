import type { SyncResponse } from '@kupi/shared';

import type { ListCache } from './local-cache';
import { mergeItems } from './merge-items';
import type { QueuedChange } from './queue';

/** Сливает ответ `POST /sync` в кеш: обновляет items/lastSeenSeq и убирает
 * из очереди только те правки, что реально ушли в этом запросе. */
export function applySyncResponse(
  current: ListCache,
  response: SyncResponse,
  sent: QueuedChange[],
): ListCache {
  return {
    items: mergeItems(current.items, response.items),
    lastSeenSeq: response.seq,
    queue: current.queue.filter(
      (queueChange) => queueChange.failed || !sent.includes(queueChange),
    ),
  };
}
