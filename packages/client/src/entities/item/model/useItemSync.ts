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
  const flushAgainRef = useRef(false);

  const update = (updater: (current: ListCache) => ListCache): void => {
    const next = updater(cacheRef.current);
    cacheRef.current = next;
    saveListCache(listId, next);
    setCache(next);
  };

  const flush = async (): Promise<void> => {
    if (flushingRef.current) {
      // flush уже летит в сеть — не бросаем этот вызов, а просим текущий
      // перезапуститься по завершении, иначе изменения, добавленные во
      // время in-flight запроса, застревают в очереди навсегда.
      flushAgainRef.current = true;
      return;
    }
    // pending может быть пустым — flush всё равно должен уйти в
    // сеть, он же единственный способ получить чужие изменения (delta pull
    // по lastSeenSeq), не только отправить свои.
    const pending = cacheRef.current.queue.filter((q) => !q.failed);
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
      if (flushAgainRef.current) {
        flushAgainRef.current = false;
        flush();
      }
    }
  };

  useEffect(() => {
    const loaded = loadListCache(listId) ?? emptyCache();
    cacheRef.current = loaded;
    setCache(loaded);
    flush();
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
      flush();
    }
  };

  return {
    items: cache.items,
    pendingCount: cache.queue.filter((q) => !q.failed).length,
    failedCount: cache.queue.filter((q) => q.failed).length,
    applyChange,
  };
}
