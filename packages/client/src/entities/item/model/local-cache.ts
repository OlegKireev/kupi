import type { Item } from '@kupi/shared';

import type { QueuedChange } from './queue';

export type ListCache = {
  items: Item[];
  lastSeenSeq: number;
  queue: QueuedChange[];
};

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
  localStorage.setItem(key(listId), JSON.stringify(cache));
}

export function clearListCache(listId: string): void {
  localStorage.removeItem(key(listId));
}
