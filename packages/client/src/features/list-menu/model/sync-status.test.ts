import { expect, test } from 'vitest';
import { getSyncStatusText } from './sync-status';

test('everything synced and no failures', () => {
  expect(getSyncStatusText(0, 0, true)).toBe('Синхронизировано');
});

test('pending changes while online', () => {
  expect(getSyncStatusText(2, 0, true)).toBe('Синхронизация…');
});

test('pending changes while offline', () => {
  expect(getSyncStatusText(2, 0, false)).toBe('Офлайн, 2 в очереди');
});

test('failed changes take priority over pending/online state', () => {
  expect(getSyncStatusText(1, 3, true)).toBe('3 не отправлено');
});
