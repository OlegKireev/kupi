export function getSyncStatusText(
  pendingCount: number,
  failedCount: number,
  online: boolean,
): string {
  if (failedCount > 0) return `${failedCount} не отправлено`;
  if (pendingCount > 0) return online ? 'Синхронизация…' : `Офлайн, ${pendingCount} в очереди`;
  return 'Синхронизировано';
}
