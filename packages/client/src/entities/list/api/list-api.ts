import type { Bootstrap, List } from '@kupi/shared';

import { del, get, patch, post } from '@/shared/api';

export function getLists(): Promise<List[]> {
  return get<List[]>('/lists');
}

export function createAccount(): Promise<Bootstrap> {
  return post<Bootstrap>('/accounts');
}

export function createList(name: string): Promise<List> {
  return post<List>('/lists', { name });
}

export function renameList(id: string, name: string): Promise<List> {
  return patch<List>(`/lists/${id}`, { name });
}

export function deleteList(id: string): Promise<void> {
  return del<void>(`/lists/${id}`);
}

export function createInvite(id: string): Promise<{ code: string }> {
  return post<{ code: string }>(`/lists/${id}/invites`);
}

export function getMemberCount(id: string): Promise<number> {
  return get<{ count: number }>(`/lists/${id}/members`).then(
    (response) => response.count,
  );
}

export function joinList(code: string): Promise<List> {
  return post<List>('/lists/join', { code });
}

export function redeemLinkCode(code: string): Promise<Bootstrap> {
  return post<Bootstrap>('/link', { code });
}
