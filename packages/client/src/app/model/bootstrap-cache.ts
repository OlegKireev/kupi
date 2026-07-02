import type { Category, List } from '@kupi/shared';

// ponytail: спека называет тип целиком Bootstrap (+ account), но App.tsx
// нигде account не читает — кешируем только то, что реально используется
// при офлайн cold-start; добавить account обратно, когда появится читатель.
type BootstrapCache = { lists: List[]; categories: Category[] };

const KEY = 'kupi:bootstrap';

export function loadBootstrapCache(): BootstrapCache | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BootstrapCache;
  } catch {
    return null;
  }
}

export function saveBootstrapCache(
  lists: List[],
  categories: Category[],
): void {
  localStorage.setItem(KEY, JSON.stringify({ lists, categories }));
}
