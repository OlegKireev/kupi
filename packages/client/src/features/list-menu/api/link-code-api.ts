import { post } from '@/shared/api';

export function createLinkCode(): Promise<{ code: string }> {
  return post<{ code: string }>('/link-codes');
}
