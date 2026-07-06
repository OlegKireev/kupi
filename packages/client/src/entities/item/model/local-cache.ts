import type { Item } from '@kupi/shared';

import type { QueuedChange } from './queue';

export interface ListCache {
  items: Item[];
  lastSeenSeq: number;
  queue: QueuedChange[];
}

const key = (listId: string): string => `kupi:list:${listId}`;

export function loadListCache(listId: string): ListCache | null {
  const raw = localStorage.getItem(key(listId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ListCache;
  } catch {
    return null;
  }
}

export function saveListCache(listId: string, cache: ListCache): void {
  // Запись в кеш не должна ронять оптимистичное применение правки: в Safari
  // Private Mode / при переполнении квоты setItem бросает, но само
  // изменение и без кеша прекрасно уходит в очередь синка.
  try {
    localStorage.setItem(key(listId), JSON.stringify(cache));
  } catch {
    // кеш — не источник истины, потеря записи некритична
  }
}

export function clearListCache(listId: string): void {
  localStorage.removeItem(key(listId));
}
