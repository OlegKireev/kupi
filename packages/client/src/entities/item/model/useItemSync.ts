import { useCallback, useEffect, useRef, useState } from 'react';

import type { ItemChange } from '@kupi/shared';

import { ApiError } from '@/shared/api';
import { syncItems } from '../api/item-api';
import { applyChangeLocally } from './apply-change-locally';
import { loadListCache, saveListCache, type ListCache } from './local-cache';
import { mergeItems } from './merge-items';
import { enqueue, markAttempted } from './queue';

const emptyCache = (): ListCache => ({ items: [], lastSeenSeq: 0, queue: [] });

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
    // Pending может быть пустым — flush всё равно должен уйти в
    // Сеть, он же единственный способ получить чужие изменения (delta pull
    // По lastSeenSeq), не только отправить свои.
    const pending = cacheRef.current.queue.filter(({ failed }) => !failed);
    flushingRef.current = true;
    const { lastSeenSeq } = cacheRef.current;
    try {
      const response = await syncItems(listId, {
        changes: pending.map((queueChange) => queueChange.change),
        lastSeenSeq,
      });
      update((current) => ({
        items: mergeItems(current.items, response.items),
        lastSeenSeq: response.seq,
        // Между отправкой запроса и его ответом могли добавиться новые
        // Правки — убираем только то, что реально ушло в этой пачке,
        // Остальное (включая failed) остаётся в очереди.
        queue: current.queue.filter(
          (queueChange) => queueChange.failed || !pending.includes(queueChange),
        ),
      }));
    } catch (err) {
      if (err instanceof ApiError) {
        update((current) => {
          const failed = current.queue.filter(
            (queueChange) => queueChange.failed,
          );
          const attempted = markAttempted(
            current.queue.filter((queueChange) => !queueChange.failed),
          );
          return { ...current, queue: [...failed, ...attempted] };
        });
      }
      // Сетевая ошибка (не ApiError) — очередь не трогаем, ждём следующий `online`
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
    // Запускало flush.
    if (flushedListIdRef.current === listId) {
      return;
    }
    flushedListIdRef.current = listId;
    flush();
  }, [listId, flush]);

  useEffect(() => {
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [flush]);

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
