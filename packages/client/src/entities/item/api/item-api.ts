import type { SyncRequest, SyncResponse } from '@kupi/shared';
import { post } from '@/shared/api';

export function syncItems(listId: string, req: SyncRequest): Promise<SyncResponse> {
  return post<SyncResponse>(`/lists/${listId}/sync`, req);
}
