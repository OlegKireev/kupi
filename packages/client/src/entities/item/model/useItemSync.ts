import { useCallback, useEffect, useRef, useState } from 'react';

import type { ItemChange } from '@kupi/shared';

import { ApiError } from '@/shared/api';
import { syncItems } from '../api/item-api';
import { applyChangeLocally } from './apply-change-locally';
import { applySyncResponse } from './apply-sync-response';
import { loadListCache, saveListCache, type ListCache } from './local-cache';
import { enqueue, requeueAfterError } from './queue';

const emptyCache = (): ListCache => ({ items: [], lastSeenSeq: 0, queue: [] });

async function runFlush(
  listId: string,
  cache: ListCache,
  update: (updater: (current: ListCache) => ListCache) => void,
): Promise<void> {
  // Pending может быть пустым — flush всё равно должен уйти в
  // Сеть, он же единственный способ получить чужие изменения (delta pull
  // По lastSeenSeq), не только отправить свои.
  const pending = cache.queue.filter(({ failed }) => !failed);
  try {
    const response = await syncItems(listId, {
      changes: pending.map((queueChange) => queueChange.change),
      lastSeenSeq: cache.lastSeenSeq,
    });
    update((current) => applySyncResponse(current, response, pending));
  } catch (err) {
    if (err instanceof ApiError) {
      update((current) => ({
        ...current,
        queue: requeueAfterError(current.queue),
      }));
    }
    // Сетевая ошибка (не ApiError) — очередь не трогаем, ждём следующий `online`
  }
}

export function useItemSync(listId: string) {
  const [cache, setCache] = useState<ListCache>(emptyCache);
  const cacheRef = useRef(cache);
  const flushingRef = useRef(false);
  const flushAgainRef = useRef(false);
  const flushedListIdRef = useRef<string | null>(null);

  const update = useCallback(
    (updater: (current: ListCache) => ListCache): void => {
      const next = updater(cacheRef.current);
      cacheRef.current = next;
      saveListCache(listId, next);
      setCache(next);
    },
    [listId],
  );

  const flush = useCallback(async (): Promise<void> => {
    if (flushingRef.current) {
      // Flush уже летит в сеть — не бросаем этот вызов, а просим текущий
      // Перезапуститься по завершении, иначе изменения, добавленные во
      // Время in-flight запроса, застревают в очереди навсегда.
      flushAgainRef.current = true;
      return;
    }
    flushingRef.current = true;
    try {
      await runFlush(listId, cacheRef.current, update);
    } finally {
      flushingRef.current = false;
      if (flushAgainRef.current) {
        flushAgainRef.current = false;
        flush();
      }
    }
  }, [listId, update]);

  useEffect(() => {
    const loaded = loadListCache(listId) ?? emptyCache();
    cacheRef.current = loaded;
    setCache(loaded);
    // StrictMode в dev дважды подряд гоняет mount-эффект одного и того же
    // Инстанса (mount → cleanup → mount) — без гварда это дважды бьёт
    // SyncItems с одинаковыми параметрами. Гвардим по listId, а не булевым
    // Флагом на весь хук, чтобы реальное переключение списка всё ещё
    // Запускало flush. Тот же эффект слушает `online` — оба триггера flush
    // для текущего списка, отдельный эффект под них не нужен.
    if (flushedListIdRef.current !== listId) {
      flushedListIdRef.current = listId;
      flush();
    }
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [listId, flush]);

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
    applyChange,
    failedCount: cache.queue.filter(({ failed }) => failed).length,
    items: cache.items,
    pendingCount: cache.queue.filter(({ failed }) => !failed).length,
  };
}
