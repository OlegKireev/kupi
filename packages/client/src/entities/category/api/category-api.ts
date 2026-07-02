import type { Category } from '@kupi/shared';

import { get } from '@/shared/api';

export function getCategories(): Promise<Category[]> {
  return get<Category[]>('/categories');
}
