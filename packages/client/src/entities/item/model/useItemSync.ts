import { useEffect, useRef, useState } from 'react';
import type { Item, ItemChange } from '@kupi/shared';
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
    if (flushingRef.current || cacheRef.current.queue.length === 0) return;
    flushingRef.current = true;
    const { lastSeenSeq, queue } = cacheRef.current;
    try {
      const response = await syncItems(listId, {
        lastSeenSeq,
        changes: queue.map((q) => q.change),
      });
      update((current) => ({
        items: mergeItems(current.items, response.items),
        lastSeenSeq: response.seq,
        queue: [],
      }));
    } catch (err) {
      if (err instanceof ApiError) {
        update((current) => ({ ...current, queue: markAttempted(current.queue) }));
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
    if (navigator.onLine) void flush();
  };

  return {
    items: cache.items,
    pendingCount: cache.queue.filter((q) => !q.failed).length,
    failedCount: cache.queue.filter((q) => q.failed).length,
    applyChange,
  };
}
