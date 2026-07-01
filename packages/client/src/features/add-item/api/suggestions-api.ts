import type { Suggestion } from '@kupi/shared';
import { get } from '@/shared/api';

export function getSuggestions(query: string): Promise<Suggestion[]> {
  return get<Suggestion[]>(`/suggestions?q=${encodeURIComponent(query)}`);
}
