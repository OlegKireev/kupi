import { describe, expect, it } from 'vitest';

import { getSyncStatusText } from './sync-status';

describe('getSyncStatusText()', () => {
  it('everything synced and no failures', () => {
    expect(getSyncStatusText(0, 0, true)).toBe('Синхронизировано');
  });

  it('pending changes while online', () => {
    expect(getSyncStatusText(2, 0, true)).toBe('Синхронизация…');
  });

  it('pending changes while offline', () => {
    expect(getSyncStatusText(2, 0, false)).toBe('Офлайн, 2 в очереди');
  });

  it('failed changes take priority over pending/online state', () => {
    expect(getSyncStatusText(1, 3, true)).toBe('3 не отправлено');
  });
});
