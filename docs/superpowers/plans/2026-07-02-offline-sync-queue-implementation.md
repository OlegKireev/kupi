# Оффлайн-очередь и sync-статус — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Мутации товаров (`toggle`/`add`/`edit`/`delete`) применяются локально и мгновенно, даже без сети; несинканные изменения складываются в очередь в `localStorage` и досылаются при восстановлении сети; список открывается из локального кеша без сети вообще; в меню списка видно, синхронизировано ли всё.

**Architecture:** Реализует `docs/superpowers/specs/2026-07-02-offline-sync-queue-design.md` как есть — ничего не решает заново. Централизованный хук `entities/item/model/useItemSync.ts` заменяет прямые вызовы `syncItems`/`onSynced` в трёх feature-хуках (`useToggleItem`/`useAddItem`/`useEditItem`): они больше не знают про сеть, только строят `ItemChange` и зовут `applyChange`. Хранилище — `localStorage` (два ключа: `kupi:list:<listId>` и `kupi:bootstrap`), без новых async-хранилищ.

**Tech Stack:** React 19 (существующий стек клиента), `@kupi/shared` для типов `Item`/`ItemChange`/`SyncRequest`/`SyncResponse`. Новая dev-зависимость: `vitest` + `jsdom` — первый тестраннер для `@kupi/client` (сервер использует `node:test`, который не транспилирует TS/JSX без отдельной обвязки).

**Тесты:** только для чистой логики без DOM/React — `queue.ts` (ретрай-политика), `apply-change-locally.ts` (оптимистичный патч), `local-cache.ts` (localStorage-обёртка), `sync-status.ts` (текст статуса). Хуки (`useItemSync`, `useOnlineStatus`) и UI не покрываются автотестами — так решено в спеке («о React Testing Library речи нет»); их корректность проверяется вручную в финальном таске.

---

## Отклонение от спеки (озвучить, не молчать)

Спека описывает `kupi:bootstrap` как `{ account: Account, lists: List[], categories: Category[] }`. `App.tsx` нигде не хранит и не читает `account` — ни сейчас, ни после этой задачи. Кешируем только `{ lists, categories }`; поле `account` роняем как неиспользуемое. Если понадобится (например, для будущего экрана профиля) — добавить обратно тогда, не раньше.

---

## Файловая структура

```
packages/client/
  vitest.config.ts                                    # новый (Task 1)
  package.json                                         # + vitest/jsdom, "test" script (Task 1)
  src/
    entities/item/
      index.ts                                         # public API сужается (Task 6)
      model/
        queue.ts                                       # новый (Task 2)
        queue.test.ts                                  # новый (Task 2)
        apply-change-locally.ts                         # новый (Task 3)
        apply-change-locally.test.ts                    # новый (Task 3)
        local-cache.ts                                  # новый (Task 4)
        local-cache.test.ts                              # новый (Task 4)
        useItemSync.ts                                  # новый (Task 5)
        merge-items.ts                                  # без изменений, используется изнутри useItemSync
    features/
      toggle-item/model/useToggleItem.ts                # signature meняется (Task 6)
      add-item/model/useAddItem.ts                       # signature меняется (Task 6)
      add-item/ui/AddItemInput.tsx                        # signature меняется (Task 6)
      edit-item/model/useEditItem.ts                      # signature меняется (Task 6)
      edit-item/ui/ItemEditor.tsx                          # signature меняется (Task 6)
      list-menu/model/sync-status.ts                       # новый (Task 8)
      list-menu/model/sync-status.test.ts                   # новый (Task 8)
      list-menu/model/useListMenu.ts                         # + syncStatusText (Task 9)
      list-menu/ui/ListMenu.tsx                               # + Menu.Label (Task 9)
    widgets/list-screen/ui/ListScreen.tsx                     # useItemSync вместо useState+syncItems (Task 6, Task 9)
    shared/lib/useOnlineStatus.ts                              # новый (Task 7)
    app/
      model/bootstrap-cache.ts                                # новый (Task 10)
      App.tsx                                                  # офлайн cold-start (Task 10)
  package.json (root)                                          # "test" запускает оба пакета (Task 1)
CLAUDE.md                                                       # документация (Task 11)
```

---

### Task 1: `vitest` для `@kupi/client`

**Files:**

- Create: `packages/client/vitest.config.ts`
- Modify: `packages/client/package.json`
- Modify: `package.json` (root)

- [ ] **Step 1: Установить зависимости**

Run: `pnpm add -D vitest jsdom --filter @kupi/client`

- [ ] **Step 2: Создать `vitest.config.ts`**

Отдельный файл (не расширение `vite.config.ts`) — чтобы не тащить `vite-plugin-pwa` в тестовое окружение и не возиться с типами `test` в `defineConfig` из `'vite'`.

```ts
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
});
```

`environment: 'jsdom'` — глобально для всех тестов пакета: большинство тестов ниже чистые (не нуждаются в DOM), но `local-cache.test.ts` использует `localStorage`, а per-file override ради нескольких тестов — лишняя сложность.

- [ ] **Step 3: Добавить скрипт `test` в `packages/client/package.json`**

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "lint:types": "tsc --noEmit",
    "lint:arch": "steiger ./src",
    "lint:js": "oxlint ."
  },
```

- [ ] **Step 4: Прокинуть клиентские тесты в корневой `pnpm test`**

`packages/shared` не имеет скрипта `test` — `--if-present` пропускает его, не падая.

```json
  "scripts": {
    "dev": "concurrently -n server,client -c blue,green \"pnpm:dev:server\" \"pnpm:dev:client\"",
    "dev:server": "pnpm --filter @kupi/server dev",
    "dev:client": "pnpm --filter @kupi/client dev",
    "build": "pnpm --filter @kupi/client build",
    "test": "pnpm -r --if-present test",
    "lint": "concurrently -n js,types,arch -c yellow,blue,magenta \"pnpm:lint:js\" \"pnpm:lint:types\" \"pnpm:lint:arch\"",
```

- [ ] **Step 5: Проверить, что конфиг не ломает typecheck**

Run: `pnpm --filter @kupi/client lint:types`
Expected: PASS (файлов с тестами пока нет, но конфиг должен типоваться сам по себе).

- [ ] **Step 6: Commit**

```bash
git add packages/client/vitest.config.ts packages/client/package.json package.json pnpm-lock.yaml
git commit -m "build(client): add vitest test runner"
```

---

### Task 2: `entities/item/model/queue.ts` — ретрай-политика очереди

**Files:**

- Create: `packages/client/src/entities/item/model/queue.ts`
- Test: `packages/client/src/entities/item/model/queue.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
import { expect, test } from 'vitest';
import type { ItemChange } from '@kupi/shared';
import { enqueue, markAttempted } from './queue';

const change: ItemChange = {
  itemId: 'item-1',
  clientOpId: 'op-1',
  op: 'upsert',
  fields: { checked: true },
};

test('enqueue appends a change with zero attempts', () => {
  const queue = enqueue([], change);
  expect(queue).toEqual([{ change, attempts: 0, failed: false }]);
});

test('markAttempted increments attempts on every entry', () => {
  const queue = enqueue([], change);
  const next = markAttempted(queue);
  expect(next[0]).toEqual({ change, attempts: 1, failed: false });
});

test('markAttempted marks an entry failed after 3 attempts', () => {
  let queue = enqueue([], change);
  queue = markAttempted(queue);
  queue = markAttempted(queue);
  queue = markAttempted(queue);
  expect(queue[0]).toEqual({ change, attempts: 3, failed: true });
});

test('markAttempted keeps a failed entry failed on further attempts', () => {
  let queue = [{ change, attempts: 3, failed: true }];
  queue = markAttempted(queue);
  expect(queue[0]).toEqual({ change, attempts: 4, failed: true });
});
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

Run: `pnpm --filter @kupi/client test -- queue`
Expected: FAIL — `Cannot find module './queue'`.

- [ ] **Step 3: Реализовать `queue.ts`**

```ts
import type { ItemChange } from '@kupi/shared';

export type QueuedChange = {
  change: ItemChange;
  attempts: number;
  failed: boolean;
};

const MAX_ATTEMPTS = 3;

export function enqueue(
  queue: QueuedChange[],
  change: ItemChange,
): QueuedChange[] {
  return [...queue, { change, attempts: 0, failed: false }];
}

export function markAttempted(queue: QueuedChange[]): QueuedChange[] {
  return queue.map((q) => {
    const attempts = q.attempts + 1;
    return { ...q, attempts, failed: q.failed || attempts >= MAX_ATTEMPTS };
  });
}
```

- [ ] **Step 4: Прогнать тест, убедиться что проходит**

Run: `pnpm --filter @kupi/client test -- queue`
Expected: PASS, 4 теста.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/entities/item/model/queue.ts packages/client/src/entities/item/model/queue.test.ts
git commit -m "feat(client): add offline queue retry-policy reducer"
```

---

### Task 3: `entities/item/model/apply-change-locally.ts` — оптимистичный патч

**Files:**

- Create: `packages/client/src/entities/item/model/apply-change-locally.ts`
- Test: `packages/client/src/entities/item/model/apply-change-locally.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
import { expect, test } from 'vitest';
import type { Item, ItemChange } from '@kupi/shared';
import { applyChangeLocally } from './apply-change-locally';

const existing: Item = {
  id: 'item-1',
  listId: 'list-1',
  name: 'Молоко',
  quantity: 1,
  categoryId: null,
  checked: false,
  version: 5,
  deleted: false,
  updatedAt: 1000,
};

test('upsert on an unknown itemId prepends a new item', () => {
  const change: ItemChange = {
    itemId: 'item-2',
    clientOpId: 'op-1',
    op: 'upsert',
    fields: { name: 'Хлеб', quantity: 1, categoryId: null },
  };
  const result = applyChangeLocally([existing], change, 'list-1');
  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({
    id: 'item-2',
    name: 'Хлеб',
    listId: 'list-1',
  });
  expect(result[1]).toEqual(existing);
});

test('upsert on a known itemId patches only the given fields', () => {
  const change: ItemChange = {
    itemId: 'item-1',
    clientOpId: 'op-1',
    op: 'upsert',
    fields: { checked: true },
  };
  const result = applyChangeLocally([existing], change, 'list-1');
  expect(result).toEqual([
    { ...existing, checked: true, updatedAt: result[0]!.updatedAt },
  ]);
});

test('delete removes the item by id', () => {
  const change: ItemChange = {
    itemId: 'item-1',
    clientOpId: 'op-1',
    op: 'delete',
    fields: {},
  };
  expect(applyChangeLocally([existing], change, 'list-1')).toEqual([]);
});

test('delete on an unknown itemId is a no-op', () => {
  const change: ItemChange = {
    itemId: 'does-not-exist',
    clientOpId: 'op-1',
    op: 'delete',
    fields: {},
  };
  expect(applyChangeLocally([existing], change, 'list-1')).toEqual([existing]);
});
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

Run: `pnpm --filter @kupi/client test -- apply-change-locally`
Expected: FAIL — `Cannot find module './apply-change-locally'`.

- [ ] **Step 3: Реализовать `apply-change-locally.ts`**

Новый item собирается прямо из `change.fields` — на одном устройстве правки всегда «последние», LWW-логика сервера (`sync/merge.ts`) тут не нужна. `version`/`updatedAt` — заглушки до подтверждения сервером: флаш перезапишет их настоящими значениями через `mergeItems`.

```ts
import type { Item, ItemChange } from '@kupi/shared';

export function applyChangeLocally(
  items: Item[],
  change: ItemChange,
  listId: string,
): Item[] {
  const index = items.findIndex((item) => item.id === change.itemId);

  if (change.op === 'delete') {
    return index === -1
      ? items
      : items.filter((item) => item.id !== change.itemId);
  }

  if (index === -1) {
    const newItem: Item = {
      id: change.itemId,
      listId,
      name: change.fields.name ?? '',
      quantity: change.fields.quantity ?? 1,
      categoryId: change.fields.categoryId ?? null,
      checked: change.fields.checked ?? false,
      version: 0,
      deleted: false,
      updatedAt: Date.now(),
    };
    return [newItem, ...items];
  }

  return items.map((item, i) =>
    i === index ? { ...item, ...change.fields, updatedAt: Date.now() } : item,
  );
}
```

Новый товар оказывается в начале массива, а не в конце (`[newItem, ...items]`) — так `ListScreen`'ов `sortedItems` (сортирует только по `checked`, порядок внутри группы не трогает) покажет только что добавленный товар сверху без скролла — то же поведение, что раньше давал ручной `onSyncedPinned` в `ListScreen.tsx`, только теперь оно встроено в сам патч, а не отдельным колбэком.

- [ ] **Step 4: Прогнать тест, убедиться что проходит**

Run: `pnpm --filter @kupi/client test -- apply-change-locally`
Expected: PASS, 4 теста.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/entities/item/model/apply-change-locally.ts packages/client/src/entities/item/model/apply-change-locally.test.ts
git commit -m "feat(client): add optimistic local item patch"
```

---

### Task 4: `entities/item/model/local-cache.ts` — `localStorage`-обёртка

**Files:**

- Create: `packages/client/src/entities/item/model/local-cache.ts`
- Test: `packages/client/src/entities/item/model/local-cache.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
import { beforeEach, expect, test } from 'vitest';
import type { ListCache } from './local-cache';
import { loadListCache, saveListCache } from './local-cache';

beforeEach(() => {
  localStorage.clear();
});

test('loadListCache returns null when nothing was saved', () => {
  expect(loadListCache('list-1')).toBeNull();
});

test('saveListCache then loadListCache round-trips the cache', () => {
  const cache: ListCache = { items: [], lastSeenSeq: 3, queue: [] };
  saveListCache('list-1', cache);
  expect(loadListCache('list-1')).toEqual(cache);
});

test('loadListCache returns null for corrupted JSON instead of throwing', () => {
  localStorage.setItem('kupi:list:list-1', 'not json');
  expect(loadListCache('list-1')).toBeNull();
});

test('caches for different lists do not collide', () => {
  saveListCache('list-1', { items: [], lastSeenSeq: 1, queue: [] });
  saveListCache('list-2', { items: [], lastSeenSeq: 2, queue: [] });
  expect(loadListCache('list-1')?.lastSeenSeq).toBe(1);
  expect(loadListCache('list-2')?.lastSeenSeq).toBe(2);
});
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

Run: `pnpm --filter @kupi/client test -- local-cache`
Expected: FAIL — `Cannot find module './local-cache'`.

- [ ] **Step 3: Реализовать `local-cache.ts`**

```ts
import type { Item } from '@kupi/shared';
import type { QueuedChange } from './queue';

export type ListCache = {
  items: Item[];
  lastSeenSeq: number;
  queue: QueuedChange[];
};

const key = (listId: string): string => `kupi:list:${listId}`;

export function loadListCache(listId: string): ListCache | null {
  const raw = localStorage.getItem(key(listId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ListCache;
  } catch {
    return null;
  }
}

export function saveListCache(listId: string, cache: ListCache): void {
  localStorage.setItem(key(listId), JSON.stringify(cache));
}
```

- [ ] **Step 4: Прогнать тест, убедиться что проходит**

Run: `pnpm --filter @kupi/client test -- local-cache`
Expected: PASS, 4 теста.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/entities/item/model/local-cache.ts packages/client/src/entities/item/model/local-cache.test.ts
git commit -m "feat(client): add localStorage cache for list items and queue"
```

---

### Task 5: `entities/item/model/useItemSync.ts` — центральный синк-хук

**Files:**

- Create: `packages/client/src/entities/item/model/useItemSync.ts`

Не покрывается автотестом — логика внутри уже покрыта тестами Task 2—4 (`enqueue`/`markAttempted`/`applyChangeLocally`/кеш), а хук — их композиция с React-стейтом и сетевым вызовом; спека сознательно ограничивает автотесты чистой логикой. Корректность хука проверяется вручную в Task 12.

- [ ] **Step 1: Реализовать хук**

Читает кеш один раз при маунте (stale-while-revalidate — устаревшие данные видны сразу, флаш в фоне их обновит), пишет кеш при каждом изменении стейта. `cacheRef` держит кеш синхронно (обновляется прямо внутри `setCache`, а не в отдельном эффекте) — чтобы `flush`, вызванный сразу после `applyChange` в том же тике, не читал устаревшее замыкание.

```ts
import { useEffect, useRef, useState } from 'react';
import type { Item, ItemChange } from '@kupi/shared';
import { ApiError } from '@/shared/api';
import { syncItems } from '../api/item-api';
import { applyChangeLocally } from './apply-change-locally';
import type { ListCache } from './local-cache';
import { loadListCache, saveListCache } from './local-cache';
import { mergeItems } from './merge-items';
import { enqueue, markAttempted } from './queue';

const emptyCache = (): ListCache => ({ items: [], lastSeenSeq: 0, queue: [] });

export function useItemSync(listId: string) {
  const [cache, setCache] = useState<ListCache>(emptyCache);
  const cacheRef = useRef(cache);
  const flushingRef = useRef(false);

  const update = (updater: (current: ListCache) => ListCache): void => {
    setCache((current) => {
      const next = updater(current);
      cacheRef.current = next;
      saveListCache(listId, next);
      return next;
    });
  };

  const flush = async (): Promise<void> => {
    if (flushingRef.current || cacheRef.current.queue.length === 0) return;
    flushingRef.current = true;
    const { lastSeenSeq, queue } = cacheRef.current;
    try {
      const response = await syncItems(listId, {
        lastSeenSeq,
        changes: queue.map((q) => q.change),
      });
      update((current) => ({
        items: mergeItems(current.items, response.items),
        lastSeenSeq: response.seq,
        queue: [],
      }));
    } catch (err) {
      if (err instanceof ApiError) {
        update((current) => ({
          ...current,
          queue: markAttempted(current.queue),
        }));
      }
      // сетевая ошибка (не ApiError) — очередь не трогаем, ждём следующий `online`
    } finally {
      flushingRef.current = false;
    }
  };

  useEffect(() => {
    const loaded = loadListCache(listId) ?? emptyCache();
    cacheRef.current = loaded;
    setCache(loaded);
    void flush();
  }, [listId]);

  useEffect(() => {
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [listId]);

  const applyChange = (change: ItemChange): void => {
    update((current) => ({
      items: applyChangeLocally(current.items, change, listId),
      lastSeenSeq: current.lastSeenSeq,
      queue: enqueue(current.queue, change),
    }));
    if (navigator.onLine) void flush();
  };

  return {
    items: cache.items,
    pendingCount: cache.queue.filter((q) => !q.failed).length,
    failedCount: cache.queue.filter((q) => q.failed).length,
    applyChange,
  };
}
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm --filter @kupi/client lint:types`
Expected: PASS (хук пока никем не импортируется, но должен компилироваться сам по себе).

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/entities/item/model/useItemSync.ts
git commit -m "feat(client): add centralized item sync hook"
```

---

### Task 6: Переключить мутации на `applyChange`

Один атомарный рефакторинг: три feature-хука перестают знать про `syncItems`/сеть, `ListScreen` переходит на `useItemSync`, публичный API `entities/item` сужается. Разбито по файлам, но коммит один — промежуточные состояния между файлами не компилируются (сигнатуры меняются с двух сторон вызова разом).

**Files:**

- Modify: `packages/client/src/features/toggle-item/model/useToggleItem.ts`
- Modify: `packages/client/src/features/add-item/model/useAddItem.ts`
- Modify: `packages/client/src/features/add-item/ui/AddItemInput.tsx`
- Modify: `packages/client/src/features/edit-item/model/useEditItem.ts`
- Modify: `packages/client/src/features/edit-item/ui/ItemEditor.tsx`
- Modify: `packages/client/src/widgets/list-screen/ui/ListScreen.tsx`
- Modify: `packages/client/src/entities/item/index.ts`

- [ ] **Step 1: `useToggleItem.ts`**

```ts
import type { Item, ItemChange } from '@kupi/shared';
import { generateId } from '@/shared/lib/ids';

type Params = {
  applyChange: (change: ItemChange) => void;
};

export function useToggleItem({ applyChange }: Params) {
  return function toggle(item: Item): void {
    applyChange({
      itemId: item.id,
      clientOpId: generateId(),
      op: 'upsert',
      fields: { checked: !item.checked },
    });
  };
}
```

- [ ] **Step 2: `useAddItem.ts`**

```ts
import { useRef, useState } from 'react';
import type { ItemChange, Suggestion } from '@kupi/shared';
import { generateId } from '@/shared/lib/ids';
import { getSuggestions } from '../api/suggestions-api';

type Params = {
  applyChange: (change: ItemChange) => void;
};

export function useAddItem({ applyChange }: Params) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const latestQueryRef = useRef('');
  // Mantine's Autocomplete fires onOptionSubmit and a controlled
  // onChange(label) echo for the same selection (mouse or keyboard). This
  // flag lets addItem's caller suppress that echo and a racing Enter-submit
  // triggered before Mantine registers the selection - see AddItemInput.
  const justSelectedRef = useRef(false);

  const onTextChange = async (value: string): Promise<void> => {
    if (justSelectedRef.current) return;
    setText(value);
    latestQueryRef.current = value;
    const results = value.trim() ? await getSuggestions(value) : [];
    if (latestQueryRef.current === value) {
      setSuggestions(results);
    }
  };

  const addItem = (name: string): void => {
    const trimmed = name.trim();
    if (!trimmed) return;
    applyChange({
      itemId: generateId(),
      clientOpId: generateId(),
      op: 'upsert',
      fields: { name: trimmed, quantity: 1, categoryId: null },
    });
    setText('');
    setSuggestions([]);
  };

  const submit = (): void => addItem(text);

  const selectSuggestion = (name: string): void => {
    justSelectedRef.current = true;
    queueMicrotask(() => {
      justSelectedRef.current = false;
    });
    addItem(name);
  };

  const submitOnEnter = (): void => {
    queueMicrotask(() => {
      if (justSelectedRef.current) {
        return;
      }
      submit();
    });
  };

  return { text, suggestions, onTextChange, submitOnEnter, selectSuggestion };
}
```

- [ ] **Step 3: `AddItemInput.tsx`**

```tsx
import type { ItemChange } from '@kupi/shared';
import { Autocomplete } from '@/shared/ui';
import { useAddItem } from '../model/useAddItem';

type Props = {
  applyChange: (change: ItemChange) => void;
};

export function AddItemInput({ applyChange }: Props) {
  const { text, suggestions, onTextChange, submitOnEnter, selectSuggestion } =
    useAddItem({ applyChange });

  return (
    <Autocomplete
      value={text}
      placeholder="Добавить товар"
      data={suggestions.map((s) => ({ value: s.name, label: s.name }))}
      renderOption={({ option }) => {
        const count = suggestions.find((s) => s.name === option.value)?.count;
        return `${option.value} (${count})`;
      }}
      onChange={onTextChange}
      onOptionSubmit={selectSuggestion}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submitOnEnter();
      }}
    />
  );
}
```

- [ ] **Step 4: `useEditItem.ts`**

```ts
import type { Item, ItemChange } from '@kupi/shared';
import { generateId } from '@/shared/lib/ids';

type Params = {
  applyChange: (change: ItemChange) => void;
};

export function useEditItem({ applyChange }: Params) {
  const setQuantity = (item: Item, quantity: number) =>
    applyChange({
      itemId: item.id,
      clientOpId: generateId(),
      op: 'upsert',
      fields: { quantity },
    });

  const setCategory = (item: Item, categoryId: string) =>
    applyChange({
      itemId: item.id,
      clientOpId: generateId(),
      op: 'upsert',
      fields: { categoryId },
    });

  const deleteItem = (item: Item) =>
    applyChange({
      itemId: item.id,
      clientOpId: generateId(),
      op: 'delete',
      fields: {},
    });

  return { setQuantity, setCategory, deleteItem };
}
```

- [ ] **Step 5: `ItemEditor.tsx`**

```tsx
import type { Category, Item, ItemChange } from '@kupi/shared';
import {
  ActionIcon,
  Button,
  Chip,
  Group,
  Stack,
  Text,
  TrashIcon,
} from '@/shared/ui';
import { useEditItem } from '../model/useEditItem';

type Props = {
  item: Item;
  categories: Category[];
  applyChange: (change: ItemChange) => void;
  onClose: () => void;
};

export function ItemEditor({ item, categories, applyChange, onClose }: Props) {
  const { setQuantity, setCategory, deleteItem } = useEditItem({ applyChange });

  return (
    <Stack component="li">
      <Group p={'0 16px 16px'}>
        <Group
          gap="xs"
          wrap="nowrap"
        >
          <ActionIcon
            variant="default"
            aria-label="Уменьшить количество"
            onClick={() => setQuantity(item, Math.max(1, item.quantity - 1))}
          >
            −
          </ActionIcon>
          <Text>{item.quantity}</Text>
          <ActionIcon
            variant="default"
            aria-label="Увеличить количество"
            onClick={() => setQuantity(item, item.quantity + 1)}
          >
            +
          </ActionIcon>
        </Group>
        <Button
          variant="subtle"
          color="red"
          ml="auto"
          leftSection={<TrashIcon />}
          size="compact-sm"
          onClick={() => {
            deleteItem(item);
            onClose();
          }}
        >
          Удалить
        </Button>
        <Chip.Group
          multiple={false}
          value={item.categoryId}
          onChange={(value) => setCategory(item, value)}
        >
          <Group gap="xs">
            {categories.map((c) => (
              <Chip
                key={c.id}
                value={c.id}
              >
                {c.icon} {c.name}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      </Group>
    </Stack>
  );
}
```

- [ ] **Step 6: `ListScreen.tsx`**

```tsx
import { useMemo, useState } from 'react';
import type { Category, List } from '@kupi/shared';
import { CategoryIcon } from '@/entities/category';
import { ItemRow, useItemSync } from '@/entities/item';
import { AddItemInput } from '@/features/add-item';
import { ItemEditor } from '@/features/edit-item';
import { ListMenu } from '@/features/list-menu';
import { ListSwitcher } from '@/features/list-switcher';
import { useToggleItem } from '@/features/toggle-item';
import { Group, List as ListComponent, Stack, Text } from '@/shared/ui';

type Props = {
  list: List;
  lists: List[];
  categories: Category[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
};

export function ListScreen({
  list,
  lists,
  categories,
  onSwitchList,
  onListsChanged,
}: Props) {
  const { items, applyChange } = useItemSync(list.id);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const sortedItems = useMemo(
    () => items.slice().sort((a, b) => Number(a.checked) - Number(b.checked)),
    [items],
  );

  const toggle = useToggleItem({ applyChange });

  return (
    <Stack p={12}>
      <Group
        justify="space-between"
        wrap="nowrap"
      >
        <ListSwitcher
          list={list}
          lists={lists}
          onSwitchList={onSwitchList}
          onListsChanged={onListsChanged}
        />
        <ListMenu
          list={list}
          onListsChanged={onListsChanged}
        />
      </Group>
      <AddItemInput applyChange={applyChange} />
      {sortedItems.length === 0 && (
        <Text c="dimmed">
          Список пуст. Начни печатать выше — появятся подсказки из твоих частых
          покупок.
        </Text>
      )}
      <ListComponent pl={0}>
        {sortedItems.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            categoryIcon={
              <CategoryIcon
                category={categories.find((c) => c.id === item.categoryId)}
              />
            }
            editor={
              item.id === expandedItemId ? (
                <ItemEditor
                  key={item.id}
                  item={item}
                  categories={categories}
                  applyChange={applyChange}
                  onClose={() => setExpandedItemId(null)}
                />
              ) : null
            }
            onToggle={() => toggle(item)}
            onOpen={() =>
              setExpandedItemId(item.id === expandedItemId ? null : item.id)
            }
          />
        ))}
      </ListComponent>
    </Stack>
  );
}
```

`pendingCount`/`failedCount` из `useItemSync` сюда не идут — они появятся в `ListMenu` в Task 9, отдельным маленьким диффом этого же файла.

- [ ] **Step 7: `entities/item/index.ts`**

`syncItems`/`mergeItems` были публичными только ради `ListScreen`; теперь их единственный потребитель — `useItemSync.ts` внутри того же слайса (относительный импорт, публичный API не нужен).

```ts
export type { Item } from '@kupi/shared';
export { useItemSync } from './model/useItemSync';
export { ItemRow } from './ui/ItemRow';
```

- [ ] **Step 8: Проверить типы, границы FSD и линт**

Run: `pnpm --filter @kupi/client lint:types && pnpm --filter @kupi/client lint:arch && pnpm --filter @kupi/client lint:js`
Expected: PASS без ошибок.

- [ ] **Step 9: Commit**

```bash
git add packages/client/src/features/toggle-item/model/useToggleItem.ts \
        packages/client/src/features/add-item/model/useAddItem.ts \
        packages/client/src/features/add-item/ui/AddItemInput.tsx \
        packages/client/src/features/edit-item/model/useEditItem.ts \
        packages/client/src/features/edit-item/ui/ItemEditor.tsx \
        packages/client/src/widgets/list-screen/ui/ListScreen.tsx \
        packages/client/src/entities/item/index.ts
git commit -m "$(cat <<'EOF'
refactor(client): route item mutations through the offline sync queue

Три feature-хука (toggle/add/edit) больше не знают про syncItems/сеть —
строят ItemChange и зовут applyChange из useItemSync. ListScreen отдаёт
хранение items/lastSeenSeq и сетевую логику useItemSync целиком.
EOF
)"
```

---

### Task 7: `shared/lib/useOnlineStatus.ts`

**Files:**

- Create: `packages/client/src/shared/lib/useOnlineStatus.ts`

Тонкая обёртка над `window`-событиями `online`/`offline` — не покрывается автотестом (нет `renderHook`-обвязки в проекте, заводить её ради одного хука избыточно); проверяется вручную вместе с Task 9.

- [ ] **Step 1: Реализовать хук**

```ts
import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm --filter @kupi/client lint:types`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/shared/lib/useOnlineStatus.ts
git commit -m "feat(client): add useOnlineStatus hook"
```

---

### Task 8: `features/list-menu/model/sync-status.ts`

**Files:**

- Create: `packages/client/src/features/list-menu/model/sync-status.ts`
- Test: `packages/client/src/features/list-menu/model/sync-status.test.ts`

- [ ] **Step 1: Написать падающий тест**

```ts
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
```

- [ ] **Step 2: Прогнать тест, убедиться что падает**

Run: `pnpm --filter @kupi/client test -- sync-status`
Expected: FAIL — `Cannot find module './sync-status'`.

- [ ] **Step 3: Реализовать `sync-status.ts`**

`failedCount > 0` проверяется первым — это самое требующее внимания состояние (авто-ретраи для этих правок уже остановлены), должно перекрывать «идёт синхронизация»/«офлайн», даже если часть очереди ещё не исчерпала попытки.

```ts
export function getSyncStatusText(
  pendingCount: number,
  failedCount: number,
  online: boolean,
): string {
  if (failedCount > 0) return `${failedCount} не отправлено`;
  if (pendingCount > 0)
    return online ? 'Синхронизация…' : `Офлайн, ${pendingCount} в очереди`;
  return 'Синхронизировано';
}
```

- [ ] **Step 4: Прогнать тест, убедиться что проходит**

Run: `pnpm --filter @kupi/client test -- sync-status`
Expected: PASS, 4 теста.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/features/list-menu/model/sync-status.ts packages/client/src/features/list-menu/model/sync-status.test.ts
git commit -m "feat(client): add sync-status text derivation"
```

---

### Task 9: Показать sync-статус в меню списка

**Files:**

- Modify: `packages/client/src/features/list-menu/model/useListMenu.ts`
- Modify: `packages/client/src/features/list-menu/ui/ListMenu.tsx`
- Modify: `packages/client/src/widgets/list-screen/ui/ListScreen.tsx`

- [ ] **Step 1: `useListMenu.ts` — принять `pendingCount`/`failedCount`, вычислить текст**

```ts
import { useState } from 'react';
import type { List } from '@kupi/shared';
import {
  createInvite,
  deleteList,
  getMemberCount,
  renameList,
} from '@/entities/list';
import { useOnlineStatus } from '@/shared/lib/useOnlineStatus';
import { createLinkCode } from '../api/link-code-api';
import { getSyncStatusText } from './sync-status';

type Params = {
  list: List;
  onListsChanged: (selectId?: string) => void;
  pendingCount: number;
  failedCount: number;
};

type CodeModalState = { title: string; code: string } | null;

export function useListMenu({
  list,
  onListsChanged,
  pendingCount,
  failedCount,
}: Params) {
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [codeModal, setCodeModal] = useState<CodeModalState>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(list.name);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const online = useOnlineStatus();
  const syncStatusText = getSyncStatusText(pendingCount, failedCount, online);

  const loadMemberCount = (): void => {
    void getMemberCount(list.id).then(setMemberCount);
  };

  const openInvite = async (): Promise<void> => {
    const { code } = await createInvite(list.id);
    setCodeModal({ title: 'Код приглашения', code });
  };

  const openLinkDevice = async (): Promise<void> => {
    const { code } = await createLinkCode();
    setCodeModal({ title: 'Код подключения устройства', code });
  };

  const closeCodeModal = (): void => setCodeModal(null);

  const openRename = (): void => {
    setRenameValue(list.name);
    setRenameOpen(true);
  };

  const closeRename = (): void => setRenameOpen(false);

  const submitRename = async (): Promise<void> => {
    const name = renameValue.trim();
    if (!name) return;
    await renameList(list.id, name);
    setRenameOpen(false);
    onListsChanged();
  };

  const openConfirmDelete = (): void => setConfirmDeleteOpen(true);
  const closeConfirmDelete = (): void => setConfirmDeleteOpen(false);

  const confirmDelete = async (): Promise<void> => {
    await deleteList(list.id);
    setConfirmDeleteOpen(false);
    onListsChanged();
  };

  return {
    memberCount,
    codeModal,
    renameOpen,
    renameValue,
    confirmDeleteOpen,
    syncStatusText,
    loadMemberCount,
    openInvite,
    openLinkDevice,
    closeCodeModal,
    openRename,
    closeRename,
    setRenameValue,
    submitRename,
    openConfirmDelete,
    closeConfirmDelete,
    confirmDelete,
  };
}
```

- [ ] **Step 2: `ListMenu.tsx` — принять пропсы, показать `Menu.Label`**

```tsx
import type { List } from '@kupi/shared';

import {
  ActionIcon,
  Button,
  Menu,
  Modal,
  Text,
  TextInput,
  CopyIcon,
  DotsThreeVerticalIcon,
  TrashIcon,
  UserPlusIcon,
  UsersFourIcon,
  DevicesIcon,
  TextboxIcon,
} from '@/shared/ui';
import { useListMenu } from '../model/useListMenu';

type Props = {
  list: List;
  onListsChanged: (selectId?: string) => void;
  pendingCount: number;
  failedCount: number;
};

export function ListMenu({
  list,
  onListsChanged,
  pendingCount,
  failedCount,
}: Props) {
  const {
    memberCount,
    codeModal,
    renameOpen,
    renameValue,
    confirmDeleteOpen,
    syncStatusText,
    loadMemberCount,
    openInvite,
    openLinkDevice,
    closeCodeModal,
    openRename,
    closeRename,
    setRenameValue,
    submitRename,
    openConfirmDelete,
    closeConfirmDelete,
    confirmDelete,
  } = useListMenu({ list, onListsChanged, pendingCount, failedCount });

  return (
    <>
      <Menu onOpen={loadMemberCount}>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            aria-label="Меню списка"
          >
            <DotsThreeVerticalIcon size={20} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{syncStatusText}</Menu.Label>
          <Menu.Item
            leftSection={<UserPlusIcon size={16} />}
            onClick={openInvite}
          >
            Пригласить
          </Menu.Item>
          <Menu.Item
            disabled
            leftSection={<UsersFourIcon size={16} />}
          >
            Участники ({memberCount ?? '…'})
          </Menu.Item>
          <Menu.Item
            leftSection={<DevicesIcon size={16} />}
            onClick={openLinkDevice}
          >
            Подключить устройство
          </Menu.Item>
          <Menu.Item
            leftSection={<TextboxIcon size={16} />}
            onClick={openRename}
          >
            Переименовать список
          </Menu.Item>
          <Menu.Item
            color="red"
            leftSection={<TrashIcon size={16} />}
            onClick={openConfirmDelete}
          >
            Удалить/покинуть список
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={codeModal !== null}
        onClose={closeCodeModal}
        title={codeModal?.title}
      >
        <Text
          size="xl"
          fw={700}
          ta="center"
        >
          {codeModal?.code}
        </Text>
        <Button
          mt="md"
          fullWidth
          leftSection={<CopyIcon size={16} />}
          onClick={() => navigator.clipboard.writeText(codeModal?.code ?? '')}
        >
          Копировать
        </Button>
      </Modal>

      <Modal
        opened={renameOpen}
        onClose={closeRename}
        title="Переименовать список"
      >
        <TextInput
          value={renameValue}
          onChange={(e) => setRenameValue(e.currentTarget.value)}
          data-autofocus
        />
        <Button
          mt="md"
          fullWidth
          onClick={submitRename}
        >
          Сохранить
        </Button>
      </Modal>

      <Modal
        opened={confirmDeleteOpen}
        onClose={closeConfirmDelete}
        title="Удалить/покинуть список?"
      >
        <Text>
          Если вы владелец — список удалится для всех участников. Если вы
          участник — вы просто выйдете из него.
        </Text>
        <Button
          mt="md"
          fullWidth
          color="red"
          onClick={confirmDelete}
        >
          Подтвердить
        </Button>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: `ListScreen.tsx` — прокинуть `pendingCount`/`failedCount`**

```ts
const { items, pendingCount, failedCount, applyChange } = useItemSync(list.id);
```

```tsx
<ListMenu
  list={list}
  onListsChanged={onListsChanged}
  pendingCount={pendingCount}
  failedCount={failedCount}
/>
```

- [ ] **Step 4: Проверить типы, границы FSD и линт**

Run: `pnpm --filter @kupi/client lint:types && pnpm --filter @kupi/client lint:arch && pnpm --filter @kupi/client lint:js`
Expected: PASS без ошибок.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/features/list-menu/model/useListMenu.ts \
        packages/client/src/features/list-menu/ui/ListMenu.tsx \
        packages/client/src/widgets/list-screen/ui/ListScreen.tsx
git commit -m "feat(client): show sync status in the list menu"
```

---

### Task 10: Офлайн cold-start (`kupi:bootstrap`)

**Files:**

- Create: `packages/client/src/app/model/bootstrap-cache.ts`
- Modify: `packages/client/src/app/App.tsx`

- [ ] **Step 1: Реализовать `bootstrap-cache.ts`**

```ts
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
```

- [ ] **Step 2: Обновить `App.tsx`**

Кеш пишется при каждом изменении `lists`/`categories` (эффектом — так же, как персистится `ListCache` внутри `useItemSync`, не по трём отдельным местам мутации). При загрузке — сначала как сейчас `GET /lists`+`GET /categories`; сетевая ошибка (не `ApiError` — значит, `fetch` не достучался) читает кеш; `401` (новое устройство) — не трогается, идёт создавать аккаунт как раньше.

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Category, List } from '@kupi/shared';
import { createAccount, createList, getLists } from '@/entities/list';
import { getCategories } from '@/entities/category';
import { ListScreenPage } from '@/pages/list-screen';
import { ApiError } from '@/shared/api';
import {
  loadBootstrapCache,
  saveBootstrapCache,
} from './model/bootstrap-cache';

export function App() {
  const [lists, setLists] = useState<List[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      try {
        const [fetchedLists, cats] = await Promise.all([
          getLists(),
          getCategories(),
        ]);
        setLists(fetchedLists);
        setActiveListId(fetchedLists[0]?.id ?? null);
        setCategories(cats);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          const bootstrap = await createAccount();
          setLists(bootstrap.lists);
          setActiveListId(bootstrap.lists[0]?.id ?? null);
          setCategories(bootstrap.categories);
          return;
        }
        if (!(err instanceof ApiError)) {
          const cached = loadBootstrapCache();
          if (cached) {
            setLists(cached.lists);
            setActiveListId(cached.lists[0]?.id ?? null);
            setCategories(cached.categories);
            return;
          }
        }
        throw err;
      }
    })();
  }, []);

  useEffect(() => {
    if (lists.length > 0) saveBootstrapCache(lists, categories);
  }, [lists, categories]);

  // Перезапрашивает GET /lists после мутации (создание/переименование/удаление
  // списка) — не hot path, ручной патч состояния не нужен. Если после
  // удаления/выхода списков не осталось, создаёт список по умолчанию — тот же
  // паттерн, что при онбординге нового аккаунта.
  const refreshLists = async (selectId?: string): Promise<void> => {
    let fetchedLists = await getLists();
    if (fetchedLists.length === 0) {
      fetchedLists = [await createList('Мои покупки')];
    }
    setLists(fetchedLists);
    setActiveListId((current) => {
      const preferred = selectId ?? current;
      return preferred && fetchedLists.some((l) => l.id === preferred)
        ? preferred
        : fetchedLists[0]!.id;
    });
  };

  const activeList = lists.find((l) => l.id === activeListId);
  if (!activeList) return null;

  return (
    <ListScreenPage
      list={activeList}
      lists={lists}
      categories={categories}
      onSwitchList={setActiveListId}
      onListsChanged={refreshLists}
    />
  );
}
```

- [ ] **Step 3: Проверить типы**

Run: `pnpm --filter @kupi/client lint:types`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/app/model/bootstrap-cache.ts packages/client/src/app/App.tsx
git commit -m "feat(client): fall back to cached bootstrap when offline on cold start"
```

---

### Task 11: Обновить `CLAUDE.md`

Глобальная инструкция пользователя требует держать `CLAUDE.md` синхронным с архитектурой в рамках той же задачи, а не отдельным шагом «потом» — эта задача меняет и структуру клиента (новый `useItemSync`, офлайн-кеш), и скрипты (`pnpm test` теперь покрывает оба пакета).

**Files:**

- Modify: `CLAUDE.md` (в корне репозитория)

- [ ] **Step 1: Прочитать файл**

Read: `CLAUDE.md`

- [ ] **Step 2: Обновить строку про `pnpm test` в разделе Commands**

Найти:

```
- `pnpm test` — run the server test suite (Node's built-in test runner via `tsx`)
```

Заменить на:

```
- `pnpm test` — run every package's test suite (`pnpm -r --if-present test`):
  the server suite (Node's built-in test runner via `tsx`) and the client
  suite (`vitest run`, `packages/client`, jsdom environment)
```

- [ ] **Step 3: Убрать устаревшую фразу**

Найти (в конце раздела Commands):

```
There is no client test suite yet.
```

Заменить на:

```
`packages/client`'s vitest suite covers pure logic only (offline-queue
retry policy, optimistic local patch, localStorage cache, sync-status text)
— hooks and UI aren't covered, there's no React Testing Library in the
project yet.
```

- [ ] **Step 4: Дополнить описание `entities/` в разделе Client design**

Найти конец абзаца про `entities/`:

```
  Instead it takes a `categoryIcon: ReactNode` prop slot, filled in by
  `widgets/list-screen` (which sits above both entities).
```

Добавить сразу после (новый абзац, тот же уровень вложенности):

```
  `entities/item/model/useItemSync.ts` is the single owner of item state
  and network sync for the active list — `widgets/list-screen` no longer
  holds `items`/`lastSeenSeq` itself. It reads/writes a `localStorage` cache
  (`kupi:list:<listId>` → `{ items, lastSeenSeq, queue }`) so a list opens
  instantly from cache before any network round-trip (stale-while-revalidate:
  a background flush reconciles it). `applyChange(change)` patches `items`
  optimistically via `model/apply-change-locally.ts` (no server LWW — a
  single device's own edits are always "latest") and pushes the change onto
  a queue (`model/queue.ts`); a flush is one `syncItems` batch call, which
  doubles as the diff-sync (the existing `mergeItems` reconciliation is
  exactly the "compare cache to server" step, nothing extra needed). Flush
  triggers: mount and the `online` window event. Retry policy: a network
  error (not `ApiError`) leaves the queue untouched for the next `online`;
  an `ApiError` (server rejected — e.g. the list was deleted while offline)
  increments `attempts` on every queued change, marking it `failed` after 3
  attempts (no auto-retry after that, no manual-retry UI yet). `clientOpId`
  stays fixed across retries — safe because `sync`'s `applied_ops` dedup
  (see `sync/` below) makes replays idempotent.
```

- [ ] **Step 5: Обновить абзац `widgets/list-screen`**

Найти:

```
- **`widgets/list-screen`** — composes everything above into the actual
  screen: owns `items`/`lastSeenSeq`/`expandedItemId` state, does the initial
  sync fetch on mount (`useEffect` deps deliberately `[list.id]` only, not
  `onSynced` — mount-per-list is intentional, not a missed dependency), and
  toggles each row between `ItemRow` and `features/edit-item`'s `ItemEditor`
  by `expandedItemId`.
```

Заменить на:

```
- **`widgets/list-screen`** — composes everything above into the actual
  screen: owns only `expandedItemId` state now, `items` and sync state come
  from `entities/item`'s `useItemSync(list.id)` — mount-per-list (`[list.id]`
  as the hook's own dependency) is still intentional, not a missed
  dependency. Toggles each row between `ItemRow` and `features/edit-item`'s
  `ItemEditor` by `expandedItemId`. `toggle-item`/`add-item`/`edit-item`
  build an `ItemChange` and call `useItemSync`'s `applyChange` directly —
  none of them know about `syncItems`/the network anymore.
```

- [ ] **Step 6: Дополнить абзац `features/list-menu`**

Найти конец абзаца про `features/list-menu` (после "...regardless of role — `DELETE /lists/:id`'s owner-deletes-vs-member-leaves branching happens entirely server-side, the client never checks who owns the list."), добавить новое предложение в конец того же абзаца:

```
 The dropdown's first entry is a non-interactive `Menu.Label` showing sync
  status — derived from `entities/item`'s `pendingCount`/`failedCount` (piped
  down from `ListScreen`) and `shared/lib/useOnlineStatus.ts` by
  `model/sync-status.ts`'s `getSyncStatusText` — the sync-status line
  deferred in `2026-07-01-list-header-menu-design.md`.
```

- [ ] **Step 7: Дополнить абзац `pages/list-screen` + `app/App.tsx`**

Найти конец этого абзаца (после "...the same pattern used for a brand-new account's first list."), добавить:

```
 A network error (not `ApiError`) during the initial `GET /lists`+`GET
  /categories` falls back to a `localStorage` cache (`kupi:bootstrap`,
  written by `app/model/bootstrap-cache.ts` on every `lists`/`categories`
  change) — covers reopening the app offline. No cache yet (device's very
  first launch, offline) — unchanged empty-screen behavior, a known gap, not
  a regression.
```

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the offline sync queue architecture"
```

---

### Task 12: Ручная сквозная проверка

**Files:** нет (только команды и ручные шаги в браузере).

- [ ] **Step 1: Автоматика целиком**

Run: `pnpm install && pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное — `oxlint`/`tsc --noEmit`/`steiger` без ошибок, `vitest run` (client) и `node --test` (server) проходят, `vite build` собирается.

- [ ] **Step 2: Запустить дев-серверы**

Run: `pnpm dev`
Expected: сервер на порту 3000, клиент на 5173 (или следующем свободном), открыть `http://localhost:5173` в браузере.

- [ ] **Step 3: Офлайн-очередь и оптимистичные мутации**

В DevTools → Network → throttling → Offline. В приложении: добавить товар, отметить чекбоксом, поменять количество/категорию, удалить какой-то товар. Ожидается: каждое действие применяется мгновенно в UI (без ожидания сети — запросы должны падать в Network-табе). Открыть меню списка (⋮) — должно показывать «Офлайн, N в очереди».

- [ ] **Step 4: Флаш при восстановлении сети**

Вернуть throttling в Online. Ожидается: в течение секунды запрос `POST /api/lists/:id/sync` уходит и получает `200`, меню при повторном открытии показывает «Синхронизировано». Перезагрузить страницу — все сделанные офлайн изменения должны быть на месте (подтверждает, что они действительно доехали до сервера, а не просто отрисовались локально).

- [ ] **Step 5: Офлайн-чтение (cold start)**

С уже открытым и один раз успешно засинканным списком: поставить Offline, перезагрузить страницу (`Cmd+R`). Ожидается: список отрисовывается сразу из кеша, без бесконечного лоадера/пустого экрана, несмотря на то что `GET /lists`/`GET /categories` при офлайне падают.

- [ ] **Step 6: Ретраи и `failed`**

Смоделировать серверный reject (например, DevTools → Network → Block request URL для `**/sync`, или временно остановить `pnpm dev:server`, что даёт сетевую, а не `ApiError`-ошибку — для честного теста `ApiError`-ветки проще временно удалить список тестовым запросом `curl -X DELETE` от имени того же аккаунта, пока клиент офлайн-очередь для него ещё не отправил, либо коротко пропатчить `merge.ts`, чтобы бросать ошибку, и откатить правку после проверки). Ожидается: после 3 неудачных попыток флаша пункт меню показывает «N не отправлено», дальнейшие `online`-события эту конкретную правку больше не ретраят.
