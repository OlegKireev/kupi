import type { Bootstrap, List } from '@kupi/shared';
import { get, post } from '@/shared/api';

export function getLists(): Promise<List[]> {
  return get<List[]>('/lists');
}

export function createAccount(): Promise<Bootstrap> {
  return post<Bootstrap>('/accounts');
}
