import { useEffect, useRef, useState } from 'react';

import type { ItemChange } from '@kupi/shared';

import { ApiError } from '@/shared/api';
import { syncItems } from '../api/item-api';
import { applyChangeLocally } from './apply-change-locally';
import type { ListCache } from './local-cache';
import { loadListCache, saveListCache } from './local-cache';
import { mergeItems } from './merge-items';
import { enqueue, markAttempted } from './queue';

const emptyCache = (): ListCache => ({ items: [], lastSeenSeq: 0, queue: [] });

export function useItemSync(listId: string) {
  const [cache, setCache] = useState<ListCache>(emptyCache);
  const cacheRef = useRef(cache);
  const flushingRef = useRef(false);

  const update = (updater: (current: ListCache) => ListCache): void => {
    setCache((current) => {
      const next = updater(current);
      cacheRef.current = next;
      saveListCache(listId, next);
      return next;
    });
  };

  const flush = async (): Promise<void> => {
    const pending = cacheRef.current.queue.filter((q) => !q.failed);
    if (flushingRef.current || pending.length === 0) {
      return;
    }
    flushingRef.current = true;
    const { lastSeenSeq } = cacheRef.current;
    try {
      const response = await syncItems(listId, {
        lastSeenSeq,
        changes: pending.map((q) => q.change),
      });
      update((current) => ({
        items: mergeItems(current.items, response.items),
        lastSeenSeq: response.seq,
        // между отправкой запроса и его ответом могли добавиться новые
        // правки — убираем только то, что реально ушло в этой пачке,
        // остальное (включая failed) остаётся в очереди.
        queue: current.queue.filter((q) => q.failed || !pending.includes(q)),
      }));
    } catch (err) {
      if (err instanceof ApiError) {
        update((current) => {
          const failed = current.queue.filter((q) => q.failed);
          const attempted = markAttempted(
            current.queue.filter((q) => !q.failed),
          );
          return { ...current, queue: [...failed, ...attempted] };
        });
      }
      // сетевая ошибка (не ApiError) — очередь не трогаем, ждём следующий `online`
    } finally {
      flushingRef.current = false;
    }
  };

  useEffect(() => {
    const loaded = loadListCache(listId) ?? emptyCache();
    cacheRef.current = loaded;
    setCache(loaded);
    void flush();
  }, [listId]);

  useEffect(() => {
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [listId]);

  const applyChange = (change: ItemChange): void => {
    update((current) => ({
      items: applyChangeLocally(current.items, change, listId),
      lastSeenSeq: current.lastSeenSeq,
      queue: enqueue(current.queue, change),
    }));
    if (navigator.onLine) {
      void flush();
    }
  };

  return {
    items: cache.items,
    pendingCount: cache.queue.filter((q) => !q.failed).length,
    failedCount: cache.queue.filter((q) => q.failed).length,
    applyChange,
  };
}
