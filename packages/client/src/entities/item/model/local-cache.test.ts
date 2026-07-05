import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearListCache,
  loadListCache,
  saveListCache,
  type ListCache,
} from './local-cache';

describe('local-cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadListCache returns null when nothing was saved', () => {
    expect(loadListCache('list-1')).toBeNull();
  });

  it('saveListCache then loadListCache round-trips the cache', () => {
    const cache: ListCache = { items: [], lastSeenSeq: 3, queue: [] };
    saveListCache('list-1', cache);
    expect(loadListCache('list-1')).toStrictEqual(cache);
  });

  it('loadListCache returns null for corrupted JSON instead of throwing', () => {
    localStorage.setItem('kupi:list:list-1', 'not json');
    expect(loadListCache('list-1')).toBeNull();
  });

  it('caches for different lists do not collide', () => {
    saveListCache('list-1', { items: [], lastSeenSeq: 1, queue: [] });
    saveListCache('list-2', { items: [], lastSeenSeq: 2, queue: [] });
    expect(loadListCache('list-1')?.lastSeenSeq).toBe(1);
    expect(loadListCache('list-2')?.lastSeenSeq).toBe(2);
  });

  it('clearListCache removes only the targeted list', () => {
    saveListCache('list-1', { items: [], lastSeenSeq: 1, queue: [] });
    saveListCache('list-2', { items: [], lastSeenSeq: 2, queue: [] });
    clearListCache('list-1');
    expect(loadListCache('list-1')).toBeNull();
    expect(loadListCache('list-2')?.lastSeenSeq).toBe(2);
  });
});
