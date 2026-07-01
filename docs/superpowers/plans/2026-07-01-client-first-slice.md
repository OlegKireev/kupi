# Первый вертикальный срез клиента — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить пустой каркас `packages/client` на рабочий экран активного списка покупок (добавление/чек/правка/удаление товара) через прямые запросы к уже существующему REST API сервера, по FSD-архитектуре.

**Architecture:** Feature-Sliced Design, все 6 слоёв (`app → pages → widgets → features → entities → shared`), импорт только «вниз» через public API слайса (`index.ts`), проверяется `steiger`. Данные — голый `fetch`, состояние — `useState`, поднятое в `App.tsx`, без Context/стора/TanStack Query. Полные решения зафиксированы в `docs/superpowers/specs/2026-07-01-client-fsd-architecture-design.md` и `docs/superpowers/specs/2026-07-01-client-ui-design.md` — этот план их реализует, ничего не решает заново.

**Tech Stack:** React 19 + Vite + TypeScript (уже установлены), `@kupi/shared` (zod-типы), `steiger` + `@feature-sliced/steiger-plugin` (новые devDependencies, FSD-линтер).

**Тесты:** сознательно не пишем (см. спек: «нет логики, которую стоит покрывать» — экран без ветвлений/парсеров/денег). Верификация каждого таска — `pnpm typecheck` (root-скрипт, `tsc --noEmit` по всем пакетам); финальный таск добавляет ручную проверку в браузере.

---

## Находка при планировании (не в исходных спеках)

Два технических пробела всплыли только при сведении спеков с реальным кодом сервера — оба решены ниже, без изменения бэкенда:

1. **Cross-origin cookie-auth в dev.** Vite dev-сервер и Fastify слушают разные порты → разные origin's. `kupi_dt` — `SameSite=Lax` cookie, между портами `localhost` она пройдёт (это "same-site"), но кросс-origin `fetch` всё равно требует CORS-заголовков, которых на сервере сейчас нет (`@fastify/cors` не подключен). Вместо добавления зависимости на сервер — используем уже установленный в клиенте Vite dev-proxy (Task 1): в деве всё идёт с одного origin, CORS не нужен вообще.
2. **`GET /suggestions` не хранит категорию.** UI-спек описывает подсказки с иконкой категории и авто-простановкой категории при выборе, но `item_frequency` (см. `packages/server/src/sync/repository.ts:109-123`) хранит только `(account_id, normalized_name, count)` — `Suggestion` в `@kupi/shared` тоже без `categoryId`. Обсудили с пользователем: в первом срезе подсказки — просто автодополнение имени (`name` + `count`), без иконки и без авто-категории. Добавление `category_id` в `item_frequency` — отдельная будущая доработка бэкенда, тут не делаем.

---

## Файловая структура

```
packages/client/
  vite.config.ts                          # + server.proxy (Task 1)
  steiger.config.ts                       # новый (Task 10)
  src/
    main.tsx                              # + импорт globals.css (Task 9)
    app/
      App.tsx                             # bootstrap-логика (Task 9)
      styles/globals.css                  # новый (Task 9)
    pages/list-screen/index.tsx           # новый (Task 9)
    widgets/list-screen/
      ui/ListScreen.tsx                   # новый (Task 8)
      index.ts
    features/
      add-item/{ui,model,api}/*           # новый (Task 7)
      toggle-item/model/*                 # новый (Task 5)
      edit-item/{ui,model}/*              # новый (Task 6)
    entities/
      item/{api,model,ui}/*               # новый (Task 4)
      category/{api,ui}/*                 # новый (Task 3)
      list/api/*                          # новый (Task 2)
    shared/
      api/client.ts                       # новый (Task 1)
      lib/ids.ts                          # новый (Task 1)
      config/env.ts                       # новый (Task 1)
```

Слой `entities/item` получает дополнительный файл `model/merge-items.ts` (не был явно перечислен в архитектурном спеке) — три места (виджет, add-item, edit-item, toggle-item) одинаково мёржат дельту синка в локальный список товаров; без общей функции это дублирование upsert-by-id + фильтрации tombstone в 4 местах.

**Архитектурная поправка к спеку:** спек описывал `entities/item`'s `ItemRow` как рисующий иконку категории напрямую, но `entities/item` импортировать `entities/category` нельзя — это cross-import между слайсами одного слоя, который `steiger`'s `fsd/no-cross-imports` (часть `recommended`-пресета, Task 10) считает ошибкой. Решение: `ItemRow` принимает `categoryIcon: ReactNode` слотом, а `CategoryIcon` собирает и передаёт `widgets/list-screen` (виджет уже выше обоих entities — обычная FSD-композиция).

---

### Task 1: Инфраструктура — Vite-прокси, `shared/lib`, `shared/config`, `shared/api`

**Files:**
- Modify: `packages/client/vite.config.ts`
- Create: `packages/client/src/shared/lib/ids.ts`
- Create: `packages/client/src/shared/config/env.ts`
- Create: `packages/client/src/shared/api/client.ts`

- [ ] **Step 1: Добавить dev-прокси в `vite.config.ts`**

Ключ с `^` — regex-матчинг (Vite: префикс `^` включает regex-режим). Проксируем ровно те top-level пути, что регистрирует `app.ts` на сервере (`/health`, `/accounts`, `/categories`, `/lists`, `/link-codes`, `/link`, `/suggestions`) — при добавлении нового top-level роута на сервере список нужно обновить.

```ts
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      '^/(health|accounts|categories|lists|link-codes|link|suggestions)': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'kupi',
        short_name: 'kupi',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
      },
    }),
  ],
});
```

- [ ] **Step 2: Создать `shared/lib/ids.ts`**

```ts
export function generateId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 3: Создать `shared/config/env.ts`**

```ts
// ponytail: относительные пути + Vite dev-прокси держат клиент и сервер на одном
// origin; пересмотреть, когда клиент и сервер будут задеплоены раздельно
export const API_BASE_URL = '';
```

- [ ] **Step 4: Создать `shared/api/client.ts`**

```ts
import { API_BASE_URL } from '@/shared/config/env';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `${init?.method ?? 'GET'} ${path} -> ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
```

- [ ] **Step 5: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок (новые файлы пока никем не импортируются, но должны компилироваться сами по себе).

- [ ] **Step 6: Commit**

```bash
git add packages/client/vite.config.ts packages/client/src/shared
git commit -m "feat(client): add dev proxy and shared api/id/env infra"
```

---

### Task 2: `entities/list`

**Files:**
- Create: `packages/client/src/entities/list/api/list-api.ts`
- Create: `packages/client/src/entities/list/index.ts`

- [ ] **Step 1: `api/list-api.ts`**

```ts
import type { Bootstrap, List } from '@kupi/shared';
import { get, post } from '@/shared/api/client';

export function getLists(): Promise<List[]> {
  return get<List[]>('/lists');
}

export function createAccount(): Promise<Bootstrap> {
  return post<Bootstrap>('/accounts');
}
```

- [ ] **Step 2: `index.ts` (public API слайса)**

```ts
export type { List } from '@kupi/shared';
export { createAccount, getLists } from './api/list-api';
```

- [ ] **Step 3: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/entities/list
git commit -m "feat(client): add entities/list slice"
```

---

### Task 3: `entities/category`

**Files:**
- Create: `packages/client/src/entities/category/api/category-api.ts`
- Create: `packages/client/src/entities/category/ui/CategoryIcon.tsx`
- Create: `packages/client/src/entities/category/index.ts`

- [ ] **Step 1: `api/category-api.ts`**

```ts
import type { Category } from '@kupi/shared';
import { get } from '@/shared/api/client';

export function getCategories(): Promise<Category[]> {
  return get<Category[]>('/categories');
}
```

- [ ] **Step 2: `ui/CategoryIcon.tsx`**

Без категории (`category === undefined`) — вообще ничего не рендерим (см. UI-спек: товар без категории — без иконки/точки, без fallback-значка).

```tsx
import type { Category } from '@kupi/shared';

type Props = { category: Category | undefined };

export function CategoryIcon({ category }: Props) {
  if (!category) return null;
  return (
    <span className="category-icon">
      {category.icon}
      <span className="category-dot" style={{ backgroundColor: category.color }} />
    </span>
  );
}
```

- [ ] **Step 3: `index.ts`**

```ts
export type { Category } from '@kupi/shared';
export { getCategories } from './api/category-api';
export { CategoryIcon } from './ui/CategoryIcon';
```

- [ ] **Step 4: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/entities/category
git commit -m "feat(client): add entities/category slice"
```

---

### Task 4: `entities/item`

**Files:**
- Create: `packages/client/src/entities/item/api/item-api.ts`
- Create: `packages/client/src/entities/item/model/merge-items.ts`
- Create: `packages/client/src/entities/item/ui/ItemRow.tsx`
- Create: `packages/client/src/entities/item/index.ts`

- [ ] **Step 1: `api/item-api.ts`**

```ts
import type { SyncRequest, SyncResponse } from '@kupi/shared';
import { post } from '@/shared/api/client';

export function syncItems(listId: string, req: SyncRequest): Promise<SyncResponse> {
  return post<SyncResponse>(`/lists/${listId}/sync`, req);
}
```

- [ ] **Step 2: `model/merge-items.ts`**

`Map` в JS сохраняет порядок первой вставки ключа — обновление существующего товара не двигает его позицию, новые товары из дельты добавляются в конец. Порядок "новый товар — наверх" (после локального добавления) обеспечивает не эта функция, а вызывающий код в `widgets/list-screen` (Task 8).

```ts
import type { Item } from '@kupi/shared';

export function mergeItems(current: Item[], incoming: Item[]): Item[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].filter((item) => !item.deleted);
}
```

- [ ] **Step 3: `ui/ItemRow.tsx`**

Read-only строка: чекбокс, зачёркивание отмеченного, слот под иконку категории (см. «Архитектурная поправка» выше — сама `CategoryIcon` собирается на уровне виджета, не здесь). Разворачивание строки — не эта компонента (см. `features/edit-item`, Task 6).

```tsx
import type { ReactNode } from 'react';
import type { Item } from '@kupi/shared';

type Props = {
  item: Item;
  categoryIcon?: ReactNode;
  onToggle: () => void;
  onOpen: () => void;
};

export function ItemRow({ item, categoryIcon, onToggle, onOpen }: Props) {
  return (
    <li className={`item-row${item.checked ? ' item-row--checked' : ''}`}>
      <input type="checkbox" checked={item.checked} onChange={onToggle} />
      <span className="item-row__name" onClick={onOpen}>
        {item.name}
      </span>
      {categoryIcon}
    </li>
  );
}
```

- [ ] **Step 4: `index.ts`**

```ts
export type { Item } from '@kupi/shared';
export { syncItems } from './api/item-api';
export { mergeItems } from './model/merge-items';
export { ItemRow } from './ui/ItemRow';
```

- [ ] **Step 5: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/entities/item
git commit -m "feat(client): add entities/item slice"
```

---

### Task 5: `features/toggle-item`

**Files:**
- Create: `packages/client/src/features/toggle-item/model/useToggleItem.ts`
- Create: `packages/client/src/features/toggle-item/index.ts`

- [ ] **Step 1: `model/useToggleItem.ts`**

```ts
import type { Item, SyncResponse } from '@kupi/shared';
import { syncItems } from '@/entities/item';
import { generateId } from '@/shared/lib/ids';

type Params = {
  listId: string;
  lastSeenSeq: number;
  onSynced: (response: SyncResponse) => void;
};

export function useToggleItem({ listId, lastSeenSeq, onSynced }: Params) {
  return async function toggle(item: Item): Promise<void> {
    const response = await syncItems(listId, {
      lastSeenSeq,
      changes: [
        {
          itemId: item.id,
          clientOpId: generateId(),
          op: 'upsert',
          fields: { checked: !item.checked },
        },
      ],
    });
    onSynced(response);
  };
}
```

- [ ] **Step 2: `index.ts`**

```ts
export { useToggleItem } from './model/useToggleItem';
```

- [ ] **Step 3: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/features/toggle-item
git commit -m "feat(client): add features/toggle-item slice"
```

---

### Task 6: `features/edit-item`

Один слайс на степпер количества, чипы категорий и удаление — по спеку это одна UX-сцена «раскрытая строка», не три независимых фичи.

**Files:**
- Create: `packages/client/src/features/edit-item/model/useEditItem.ts`
- Create: `packages/client/src/features/edit-item/ui/ItemEditor.tsx`
- Create: `packages/client/src/features/edit-item/index.ts`

- [ ] **Step 1: `model/useEditItem.ts`**

```ts
import type { Item, ItemChange, SyncResponse } from '@kupi/shared';
import { syncItems } from '@/entities/item';
import { generateId } from '@/shared/lib/ids';

type Params = {
  listId: string;
  lastSeenSeq: number;
  onSynced: (response: SyncResponse) => void;
};

export function useEditItem({ listId, lastSeenSeq, onSynced }: Params) {
  const apply = async (change: ItemChange): Promise<void> => {
    const response = await syncItems(listId, { lastSeenSeq, changes: [change] });
    onSynced(response);
  };

  const setQuantity = (item: Item, quantity: number) =>
    apply({ itemId: item.id, clientOpId: generateId(), op: 'upsert', fields: { quantity } });

  const setCategory = (item: Item, categoryId: string) =>
    apply({
      itemId: item.id,
      clientOpId: generateId(),
      op: 'upsert',
      fields: { categoryId },
    });

  const deleteItem = (item: Item) =>
    apply({ itemId: item.id, clientOpId: generateId(), op: 'delete', fields: {} });

  return { setQuantity, setCategory, deleteItem };
}
```

Примечание: снятие категории обратно в «без категории» через чипы не поддерживаем — совпадает с известным пробелом бэкенда (`categoryId: null` в патче неотличимо от «поле не менялось», см. `docs/backend-known-issues.md`), это не новое ограничение, а то же самое.

- [ ] **Step 2: `ui/ItemEditor.tsx`**

Степпер — минимум 1 (нельзя уйти в 0/отрицательное). Тап по хедеру (имя + иконка) сворачивает строку обратно — симметрично `onOpen` из `ItemRow`.

```tsx
import type { Category, Item, SyncResponse } from '@kupi/shared';
import { CategoryIcon } from '@/entities/category';
import { useEditItem } from '../model/useEditItem';

type Props = {
  item: Item;
  categories: Category[];
  listId: string;
  lastSeenSeq: number;
  onSynced: (response: SyncResponse) => void;
  onClose: () => void;
};

export function ItemEditor({
  item,
  categories,
  listId,
  lastSeenSeq,
  onSynced,
  onClose,
}: Props) {
  const { setQuantity, setCategory, deleteItem } = useEditItem({
    listId,
    lastSeenSeq,
    onSynced,
  });
  const category = categories.find((c) => c.id === item.categoryId);

  return (
    <li className="item-row item-row--expanded">
      <div className="item-editor__header" onClick={onClose}>
        <span className="item-row__name">{item.name}</span>
        <CategoryIcon category={category} />
      </div>
      <div className="item-editor__quantity">
        <button
          type="button"
          onClick={() => void setQuantity(item, Math.max(1, item.quantity - 1))}
        >
          −
        </button>
        <span>{item.quantity}</span>
        <button type="button" onClick={() => void setQuantity(item, item.quantity + 1)}>
          +
        </button>
      </div>
      <div className="item-editor__categories">
        {categories.map((c) => (
          <button
            type="button"
            key={c.id}
            className={`category-chip${c.id === item.categoryId ? ' category-chip--active' : ''}`}
            onClick={() => void setCategory(item, c.id)}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="item-editor__delete"
        onClick={() => {
          void deleteItem(item);
          onClose();
        }}
      >
        Удалить товар
      </button>
    </li>
  );
}
```

- [ ] **Step 3: `index.ts`**

```ts
export { ItemEditor } from './ui/ItemEditor';
```

- [ ] **Step 4: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/features/edit-item
git commit -m "feat(client): add features/edit-item slice"
```

---

### Task 7: `features/add-item`

Подсказки — только `name`+`count` (см. «Находка при планировании» выше): без иконки категории, выбор подсказки просто подставляет имя в поле, не создаёт товар и не проставляет категорию.

**Files:**
- Create: `packages/client/src/features/add-item/api/suggestions-api.ts`
- Create: `packages/client/src/features/add-item/model/useAddItem.ts`
- Create: `packages/client/src/features/add-item/ui/AddItemInput.tsx`
- Create: `packages/client/src/features/add-item/index.ts`

- [ ] **Step 1: `api/suggestions-api.ts`**

```ts
import type { Suggestion } from '@kupi/shared';
import { get } from '@/shared/api/client';

export function getSuggestions(query: string): Promise<Suggestion[]> {
  return get<Suggestion[]>(`/suggestions?q=${encodeURIComponent(query)}`);
}
```

- [ ] **Step 2: `model/useAddItem.ts`**

`itemId` генерится клиентом (стабильность оптимистичного товара), `pinItemId` в колбэк — чтобы виджет знал, какой товар поднять наверх списка.

```ts
import { useState } from 'react';
import type { Suggestion, SyncResponse } from '@kupi/shared';
import { syncItems } from '@/entities/item';
import { generateId } from '@/shared/lib/ids';
import { getSuggestions } from '../api/suggestions-api';

type Params = {
  listId: string;
  lastSeenSeq: number;
  onSynced: (response: SyncResponse, pinItemId: string) => void;
};

export function useAddItem({ listId, lastSeenSeq, onSynced }: Params) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const onTextChange = async (value: string): Promise<void> => {
    setText(value);
    setSuggestions(value.trim() ? await getSuggestions(value) : []);
  };

  const submit = async (): Promise<void> => {
    const name = text.trim();
    if (!name) return;
    const itemId = generateId();
    const response = await syncItems(listId, {
      lastSeenSeq,
      changes: [
        {
          itemId,
          clientOpId: generateId(),
          op: 'upsert',
          fields: { name, quantity: 1, categoryId: null },
        },
      ],
    });
    onSynced(response, itemId);
    setText('');
    setSuggestions([]);
  };

  return { text, suggestions, onTextChange, submit };
}
```

- [ ] **Step 3: `ui/AddItemInput.tsx`**

```tsx
import type { SyncResponse } from '@kupi/shared';
import { useAddItem } from '../model/useAddItem';

type Props = {
  listId: string;
  lastSeenSeq: number;
  onSynced: (response: SyncResponse, pinItemId: string) => void;
};

export function AddItemInput({ listId, lastSeenSeq, onSynced }: Props) {
  const { text, suggestions, onTextChange, submit } = useAddItem({
    listId,
    lastSeenSeq,
    onSynced,
  });

  return (
    <div className="add-item">
      <input
        className="add-item__input"
        value={text}
        placeholder="Добавить товар"
        onChange={(e) => void onTextChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
      />
      {suggestions.length > 0 && (
        <ul className="add-item__suggestions">
          {suggestions.map((s) => (
            <li
              key={s.name}
              className="add-item__suggestion"
              onClick={() => void onTextChange(s.name)}
            >
              {s.name} ({s.count})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `index.ts`**

```ts
export { AddItemInput } from './ui/AddItemInput';
```

- [ ] **Step 5: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/features/add-item
git commit -m "feat(client): add features/add-item slice"
```

---

### Task 8: `widgets/list-screen`

Композиция: заголовок списка, `AddItemInput`, список строк (`ItemRow` ↔ `ItemEditor` по `expandedItemId`), пустое состояние с подсказкой (`items.length === 0`).

**Files:**
- Create: `packages/client/src/widgets/list-screen/ui/ListScreen.tsx`
- Create: `packages/client/src/widgets/list-screen/index.ts`

- [ ] **Step 1: `ui/ListScreen.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { Category, Item, List, SyncResponse } from '@kupi/shared';
import { CategoryIcon } from '@/entities/category';
import { ItemRow, mergeItems, syncItems } from '@/entities/item';
import { AddItemInput } from '@/features/add-item';
import { ItemEditor } from '@/features/edit-item';
import { useToggleItem } from '@/features/toggle-item';

type Props = { list: List; categories: Category[] };

export function ListScreen({ list, categories }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [lastSeenSeq, setLastSeenSeq] = useState(0);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const onSynced = (response: SyncResponse): void => {
    setItems((current) => mergeItems(current, response.items));
    setLastSeenSeq(response.seq);
  };

  const onSyncedPinned = (response: SyncResponse, pinItemId: string): void => {
    setItems((current) => {
      const merged = mergeItems(current, response.items);
      const pinned = merged.find((item) => item.id === pinItemId);
      return pinned
        ? [pinned, ...merged.filter((item) => item.id !== pinItemId)]
        : merged;
    });
    setLastSeenSeq(response.seq);
  };

  useEffect(() => {
    syncItems(list.id, { lastSeenSeq: 0, changes: [] }).then(onSynced);
  }, [list.id]);

  const toggle = useToggleItem({ listId: list.id, lastSeenSeq, onSynced });

  return (
    <div>
      <h1 className="list-screen__title">{list.name}</h1>
      <AddItemInput listId={list.id} lastSeenSeq={lastSeenSeq} onSynced={onSyncedPinned} />
      {items.length === 0 && (
        <p className="add-item__hint">
          Список пуст. Начни печатать выше — появятся подсказки из твоих частых
          покупок.
        </p>
      )}
      <ul>
        {items.map((item) =>
          item.id === expandedItemId ? (
            <ItemEditor
              key={item.id}
              item={item}
              categories={categories}
              listId={list.id}
              lastSeenSeq={lastSeenSeq}
              onSynced={onSynced}
              onClose={() => setExpandedItemId(null)}
            />
          ) : (
            <ItemRow
              key={item.id}
              item={item}
              categoryIcon={
                <CategoryIcon category={categories.find((c) => c.id === item.categoryId)} />
              }
              onToggle={() => toggle(item)}
              onOpen={() => setExpandedItemId(item.id)}
            />
          ),
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: `index.ts`**

```ts
export { ListScreen } from './ui/ListScreen';
```

- [ ] **Step 3: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/widgets/list-screen
git commit -m "feat(client): add widgets/list-screen slice"
```

---

### Task 9: `pages/list-screen` + `app/App.tsx` (bootstrap) + стили

Поток данных при загрузке (см. FSD-спек): `GET /lists` + `GET /categories` параллельно; если упало `401` (новое устройство) → `POST /accounts`, который возвращает `Bootstrap` целиком.

**Files:**
- Create: `packages/client/src/pages/list-screen/index.tsx`
- Create: `packages/client/src/app/styles/globals.css`
- Modify: `packages/client/src/app/App.tsx`
- Modify: `packages/client/src/main.tsx`

- [ ] **Step 1: `pages/list-screen/index.tsx`**

```tsx
import type { Category, List } from '@kupi/shared';
import { ListScreen } from '@/widgets/list-screen';

type Props = { list: List; categories: Category[] };

export function ListScreenPage({ list, categories }: Props) {
  return <ListScreen list={list} categories={categories} />;
}
```

- [ ] **Step 2: `app/styles/globals.css`**

Токены визуального стиля из UI-спека (тёплый фон, терракотовый акцент, чередующаяся подложка строк, скругления ~10px, системный шрифтовый стек).

```css
:root {
  --color-bg: #fdfcfa;
  --color-accent: #c9764f;
  --color-row-alt: #f7f4ef;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: #2b2926;
}

.list-screen__title {
  font-weight: 700;
  padding: 16px;
  margin: 0;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  list-style: none;
}

.item-row:nth-child(even) {
  background: var(--color-row-alt);
}

.item-row--checked .item-row__name {
  text-decoration: line-through;
  color: #9a948c;
}

.item-row__name {
  flex: 1;
  cursor: pointer;
}

.category-icon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.category-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.category-chip {
  border: 1px solid #e5ddd2;
  border-radius: 999px;
  padding: 4px 10px;
  margin: 4px 4px 0 0;
  background: none;
  font: inherit;
}

.category-chip--active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.item-editor__delete {
  color: var(--color-accent);
  background: none;
  border: none;
  padding: 8px 0 0;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.add-item {
  padding: 12px;
}

.add-item__input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #e5ddd2;
  border-radius: 10px;
  font: inherit;
}

.add-item__hint {
  padding: 0 12px;
  color: #9a948c;
  font-size: 0.9em;
}

.add-item__suggestions {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
}

.add-item__suggestion {
  padding: 8px 12px;
  cursor: pointer;
}
```

- [ ] **Step 3: `app/App.tsx`** (заменить целиком)

```tsx
import { useEffect, useState } from 'react';
import type { Category, List } from '@kupi/shared';
import { createAccount, getLists } from '@/entities/list';
import { getCategories } from '@/entities/category';
import { ListScreenPage } from '@/pages/list-screen';
import { ApiError } from '@/shared/api/client';

export function App() {
  const [list, setList] = useState<List | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [lists, cats] = await Promise.all([getLists(), getCategories()]);
        setList(lists[0]!);
        setCategories(cats);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          const bootstrap = await createAccount();
          setList(bootstrap.lists[0]!);
          setCategories(bootstrap.categories);
          return;
        }
        throw err;
      }
    })();
  }, []);

  if (!list) return null;
  return <ListScreenPage list={list} categories={categories} />;
}
```

- [ ] **Step 4: `main.tsx`** — добавить импорт стилей

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/App';
import '@/app/styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Примечание: `App.tsx` теперь живёт в `src/app/App.tsx` (FSD-слой `app`), а не в `src/App.tsx`. Обновить импорт в `main.tsx` на `@/app/App` и удалить старый `src/App.tsx`.

```tsx
import { App } from '@/app/App';
```

- [ ] **Step 5: Удалить старый файл**

```bash
git rm packages/client/src/App.tsx
```

- [ ] **Step 6: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/app packages/client/src/pages packages/client/src/main.tsx
git commit -m "feat(client): wire up bootstrap flow and list screen page"
```

---

### Task 10: `steiger` — проверка границ FSD-слоёв

**Files:**
- Create: `packages/client/steiger.config.ts`
- Modify: `packages/client/package.json` (добавится `pnpm add` автоматически)

- [ ] **Step 1: Установить зависимости**

```bash
pnpm --filter @kupi/client add -D steiger @feature-sliced/steiger-plugin
```

- [ ] **Step 2: `steiger.config.ts`**

```ts
import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([...fsd.configs.recommended]);
```

- [ ] **Step 3: Добавить скрипт в `packages/client/package.json`**

В секцию `"scripts"` рядом с `dev`/`build`/`preview`:

```json
"fsd-lint": "steiger ./src"
```

- [ ] **Step 4: Запустить и проверить, что срез проходит без ошибок**

Run: `pnpm --filter @kupi/client fsd-lint`
Expected: без ошибок уровня `error` (архитектурная поправка в Task 4/8 — `ItemRow` без прямого импорта `entities/category` — уже сделана именно для того, чтобы здесь не упасть на `fsd/no-cross-imports`).

- [ ] **Step 5: Commit**

```bash
git add packages/client/steiger.config.ts packages/client/package.json pnpm-lock.yaml
git commit -m "chore(client): add steiger FSD layer boundary linting"
```

---

### Task 11: Ручная сквозная проверка

Тестов на клиенте нет (см. «Тесты» в шапке плана) — единственная проверка, что срез реально работает, ручная.

- [ ] **Step 1: Запустить сервер**

Run: `pnpm dev:server` (в отдельном терминале, порт 3000)

- [ ] **Step 2: Запустить клиент**

Run: `pnpm dev:client`
Expected: Vite поднимается на порту 5173 (или следующем свободном).

- [ ] **Step 3: Открыть браузер и проверить bootstrap нового устройства**

Открыть `http://localhost:5173` в приватном окне (чистые cookies). Ожидаемо: пустой список «Мои покупки», подсказка под полем ввода. В DevTools → Application → Cookies должен появиться `kupi_dt`.

- [ ] **Step 4: Проверить добавление товара**

Ввести название товара (например, «Молоко»), нажать Enter. Ожидаемо: товар появляется вверху списка, поле ввода очищается.

- [ ] **Step 5: Проверить чек/анчек**

Тапнуть чекбокс товара. Ожидаемо: текст зачёркивается, приглушается цветом.

- [ ] **Step 6: Проверить разворачивание строки и правки**

Тапнуть по названию товара (не по чекбоксу). Ожидаемо: строка разворачивается — степпер количества, чипы категорий. Нажать `+`/`−` — число меняется. Выбрать категорию-чип — чип подсвечивается терракотовым, в свёрнутом виде должна появиться иконка категории.

- [ ] **Step 7: Проверить удаление**

В развёрнутой строке нажать «Удалить товар». Ожидаемо: строка исчезает из списка.

- [ ] **Step 8: Проверить персистентность через перезагрузку**

Обновить страницу (F5). Ожидаемо: тот же cookie → тот же список, товары (кроме удалённого) на месте — данные реально идут через сервер, не только через локальный React state.

- [ ] **Step 9: Прогнать линтеры**

Run: `pnpm lint && pnpm --filter @kupi/client fsd-lint`
Expected: без ошибок (warnings по `react-hooks/exhaustive-deps` на эффекте начальной загрузки в `ListScreen` — ожидаемы и осознанны, эффект специально mount-only).

- [ ] **Step 10: Обновить `CLAUDE.md`**

Раздел «Architecture» → `client` сейчас гласит «Currently a bare scaffold... no real UI yet» — заменить кратким описанием реализованного среза (FSD-слои, bootstrap-поток, `steiger`), аналогично тому, как описан `server`.
