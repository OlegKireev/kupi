# Redeem Invite/Link Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the client-side "redeem a code" UI so a device can join a shared
list (8-char invite code → `POST /lists/join`) or link itself to another
account (6-char link code → `POST /link`) — the receiving half of sharing that
was left as a known gap after `2026-07-01-list-header-menu-design.md`.

**Architecture:** All server endpoints already exist and need no changes. Add
a `codeKind()` pure function to classify a typed code by length, a
`useListSwitcher` hook (new — currently `ListSwitcher.tsx` holds its own
"new list" state inline) that owns both the existing new-list modal state and
the new code-entry/link-confirmation state, and wire a new `onAccountLinked`
callback from `App.tsx` down through `ListScreenPage` → `ListScreen` →
`ListSwitcher` so a successful device-link can replace the whole
lists/categories/activeListId state in one shot from the `Bootstrap` the
server already returns.

**Tech Stack:** React + TypeScript, Mantine UI (`Menu`/`Modal`/`TextInput`),
`@mantine/notifications` (new dependency, for error toasts), Vitest for the
one pure-logic unit.

**Spec:** `docs/superpowers/specs/2026-07-02-redeem-code-design.md`

---

### Task 1: Add `@mantine/notifications` and mount it

**Files:**

- Modify: `packages/client/package.json`
- Modify: `packages/client/src/main.tsx`

- [ ] **Step 1: Add the dependency**

In `packages/client/package.json`, insert into `dependencies` (alphabetical,
right after `@mantine/hooks`), matching the existing Mantine version pin:

```json
    "@mantine/hooks": "^9.4.1",
    "@mantine/notifications": "^9.4.1",
    "@phosphor-icons/react": "^2.1.10",
```

- [ ] **Step 2: Install**

Run from the repo root: `pnpm install`
Expected: lockfile updates, no errors, `packages/client/node_modules/@mantine/notifications` exists.

- [ ] **Step 3: Mount the notifications root**

`packages/client/src/main.tsx` currently:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';

import { App } from '@/app/App';
import '@/app/styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider>
      <App />
    </MantineProvider>
  </StrictMode>,
);
```

Replace with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { App } from '@/app/App';
import '@/app/styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider>
      <Notifications />
      <App />
    </MantineProvider>
  </StrictMode>,
);
```

`main.tsx` is the composition root, outside FSD's layer rules — it already
imports Mantine directly rather than through `shared/ui`, so this follows the
existing pattern.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @kupi/client lint:types`
Expected: no errors (confirms the new package resolves).

- [ ] **Step 5: Commit**

```bash
git add packages/client/package.json pnpm-lock.yaml packages/client/src/main.tsx
git commit -m "feat(client): mount @mantine/notifications for error toasts"
```

---

### Task 2: `codeKind` — classify a typed code by length

**Files:**

- Create: `packages/client/src/features/list-switcher/model/code-kind.ts`
- Create: `packages/client/src/features/list-switcher/model/code-kind.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from 'vitest';
import { codeKind } from './code-kind';

test('8-character code is a list invite', () => {
  expect(codeKind('ABCD1234')).toBe('list');
});

test('6-character code is a device link code', () => {
  expect(codeKind('ABC123')).toBe('device');
});

test('any other length is invalid', () => {
  expect(codeKind('')).toBe('invalid');
  expect(codeKind('ABC12')).toBe('invalid');
  expect(codeKind('ABCD12345')).toBe('invalid');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @kupi/client test -- code-kind`
Expected: FAIL — `code-kind.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

```ts
export type CodeKind = 'list' | 'device' | 'invalid';

// ponytail: 6/8 are today's `newCode()` lengths in `lists/routes.ts` /
// `link/routes.ts`, not a protocol contract — update here if they change.
export function codeKind(code: string): CodeKind {
  if (code.length === 8) return 'list';
  if (code.length === 6) return 'device';
  return 'invalid';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @kupi/client test -- code-kind`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/features/list-switcher/model/code-kind.ts packages/client/src/features/list-switcher/model/code-kind.test.ts
git commit -m "feat(client): add codeKind to classify invite vs link codes"
```

---

### Task 3: `entities/list` — `joinList` / `redeemLinkCode`

**Files:**

- Modify: `packages/client/src/entities/list/api/list-api.ts`
- Modify: `packages/client/src/entities/list/index.ts`

No test — this mirrors the existing untested thin wrappers in the same file
(`createList`, `renameList`, etc.).

- [ ] **Step 1: Add the two functions**

In `packages/client/src/entities/list/api/list-api.ts`, add after
`getMemberCount`:

```ts
export function joinList(code: string): Promise<List> {
  return post<List>('/lists/join', { code });
}

export function redeemLinkCode(code: string): Promise<Bootstrap> {
  return post<Bootstrap>('/link', { code });
}
```

- [ ] **Step 2: Re-export**

In `packages/client/src/entities/list/index.ts`, add `joinList` and
`redeemLinkCode` to the named export list (alphabetical):

```ts
export type { List } from '@kupi/shared';
export {
  createAccount,
  createInvite,
  createList,
  deleteList,
  getLists,
  getMemberCount,
  joinList,
  redeemLinkCode,
  renameList,
} from './api/list-api';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @kupi/client lint:types`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/entities/list/api/list-api.ts packages/client/src/entities/list/index.ts
git commit -m "feat(client): add joinList and redeemLinkCode API calls"
```

---

### Task 4: `shared/ui` — expose `KeyIcon` and `notifications`

**Files:**

- Modify: `packages/client/src/shared/ui/index.ts`

- [ ] **Step 1: Add the exports**

`shared/ui/index.ts` is the single funnel for external UI-library imports
(Mantine components, Phosphor icons) — add the icon used for the new "Ввести
код" menu item and the notifications API used to surface errors:

```ts
export {
  ActionIcon,
  Autocomplete,
  Button,
  Chip,
  Checkbox,
  InputLabel,
  Group,
  List,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
export { notifications } from '@mantine/notifications';
export {
  CaretDownIcon,
  CopyIcon,
  DotsThreeVerticalIcon,
  KeyIcon,
  TrashIcon,
  UserPlusIcon,
  UsersFourIcon,
  DevicesIcon,
  TextboxIcon,
  ListIcon,
  FilePlusIcon,
} from '@phosphor-icons/react';
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @kupi/client lint:types`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/shared/ui/index.ts
git commit -m "feat(client): expose KeyIcon and notifications via shared/ui"
```

---

### Task 5: `useListSwitcher` hook

**Files:**

- Create: `packages/client/src/features/list-switcher/model/useListSwitcher.ts`

This extracts the "new list" state currently inline in `ListSwitcher.tsx`
(same pattern as `list-menu/model/useListMenu.ts`) and adds the code-entry
and device-link-confirmation state next to it. Not unit-tested — mirrors
`useListMenu`, which is also untested (network calls + no RTL in this repo).

- [ ] **Step 1: Write the hook**

```ts
import { useState } from 'react';
import type { Bootstrap, List } from '@kupi/shared';
import { createList, joinList, redeemLinkCode } from '@/entities/list';
import { ApiError } from '@/shared/api';
import { notifications } from '@/shared/ui';
import { codeKind } from './code-kind';

type Params = {
  onListsChanged: (selectId?: string) => void;
  onAccountLinked: (bootstrap: Bootstrap) => void;
};

const INVALID_CODE_MESSAGE = 'Неверный код';

export function useListSwitcher({ onListsChanged, onAccountLinked }: Params) {
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [pendingLinkCode, setPendingLinkCode] = useState<string | null>(null);

  const openNewList = (): void => setNewListOpen(true);
  const closeNewList = (): void => setNewListOpen(false);

  const submitNewList = async (): Promise<void> => {
    const name = newListName.trim();
    if (!name) return;
    const created = await createList(name);
    setNewListName('');
    setNewListOpen(false);
    onListsChanged(created.id);
  };

  const openCode = (): void => {
    setCodeValue('');
    setCodeOpen(true);
  };
  const closeCode = (): void => setCodeOpen(false);

  const submitCode = async (): Promise<void> => {
    const kind = codeKind(codeValue);

    if (kind === 'invalid') {
      notifications.show({ color: 'red', message: INVALID_CODE_MESSAGE });
      return;
    }

    if (kind === 'device') {
      setPendingLinkCode(codeValue);
      setCodeOpen(false);
      return;
    }

    try {
      const joined: List = await joinList(codeValue);
      setCodeOpen(false);
      onListsChanged(joined.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        notifications.show({ color: 'red', message: INVALID_CODE_MESSAGE });
        return;
      }
      throw err;
    }
  };

  const cancelLinkDevice = (): void => {
    setPendingLinkCode(null);
    setCodeOpen(true);
  };

  const confirmLinkDevice = async (): Promise<void> => {
    const code = pendingLinkCode;
    if (!code) return;
    try {
      const bootstrap = await redeemLinkCode(code);
      setPendingLinkCode(null);
      onAccountLinked(bootstrap);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setPendingLinkCode(null);
        setCodeOpen(true);
        notifications.show({ color: 'red', message: INVALID_CODE_MESSAGE });
        return;
      }
      throw err;
    }
  };

  return {
    newListOpen,
    newListName,
    setNewListName,
    openNewList,
    closeNewList,
    submitNewList,
    codeOpen,
    codeValue,
    setCodeValue,
    openCode,
    closeCode,
    submitCode,
    pendingLinkCode,
    cancelLinkDevice,
    confirmLinkDevice,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @kupi/client lint:types`
Expected: no errors (the hook isn't wired into `ListSwitcher.tsx` yet, but it
must compile standalone).

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/features/list-switcher/model/useListSwitcher.ts
git commit -m "feat(client): add useListSwitcher hook with code-redeem state"
```

---

### Task 6: Wire `ListSwitcher.tsx` to the hook and new UI

**Files:**

- Modify: `packages/client/src/features/list-switcher/ui/ListSwitcher.tsx`

- [ ] **Step 1: Replace the component**

Full new contents of `ListSwitcher.tsx`:

```tsx
import type { Bootstrap, List } from '@kupi/shared';
import { useListSwitcher } from '../model/useListSwitcher';
import {
  Button,
  Group,
  Menu,
  Modal,
  Text,
  TextInput,
  Title,
  UnstyledButton,
  CaretDownIcon,
  FilePlusIcon,
  KeyIcon,
} from '@/shared/ui';

type Props = {
  list: List;
  lists: List[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
  onAccountLinked: (bootstrap: Bootstrap) => void;
};

export function ListSwitcher({
  list,
  lists,
  onSwitchList,
  onListsChanged,
  onAccountLinked,
}: Props) {
  const {
    newListOpen,
    newListName,
    setNewListName,
    openNewList,
    closeNewList,
    submitNewList,
    codeOpen,
    codeValue,
    setCodeValue,
    openCode,
    closeCode,
    submitCode,
    pendingLinkCode,
    cancelLinkDevice,
    confirmLinkDevice,
  } = useListSwitcher({ onListsChanged, onAccountLinked });

  return (
    <>
      <Menu>
        <Menu.Target>
          <UnstyledButton>
            <Group
              gap={8}
              wrap="nowrap"
            >
              <Title
                order={1}
                size="h2"
              >
                {list.name}
              </Title>
              <CaretDownIcon size={20} />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          {lists.map((l) => (
            <Menu.Item
              key={l.id}
              onClick={() => onSwitchList(l.id)}
            >
              {l.name}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item onClick={openNewList}>Новый список</Menu.Item>
          <Menu.Item
            leftSection={<KeyIcon size={16} />}
            onClick={openCode}
          >
            Ввести код
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={newListOpen}
        onClose={closeNewList}
        title="Новый список"
      >
        <TextInput
          value={newListName}
          onChange={(e) => setNewListName(e.currentTarget.value)}
          placeholder="Название списка"
          data-autofocus
        />
        <Button
          mt="md"
          fullWidth
          leftSection={<FilePlusIcon />}
          onClick={submitNewList}
        >
          Создать
        </Button>
      </Modal>

      <Modal
        opened={codeOpen}
        onClose={closeCode}
        title="Ввести код"
      >
        <TextInput
          value={codeValue}
          onChange={(e) => setCodeValue(e.currentTarget.value)}
          placeholder="Код приглашения или устройства"
          data-autofocus
        />
        <Button
          mt="md"
          fullWidth
          leftSection={<KeyIcon />}
          onClick={submitCode}
        >
          Продолжить
        </Button>
      </Modal>

      <Modal
        opened={pendingLinkCode !== null}
        onClose={cancelLinkDevice}
        title="Подключить устройство?"
      >
        <Text>
          Это заменит аккаунт этого устройства. Текущие списки станут недоступны
          с него. Продолжить?
        </Text>
        <Button
          mt="md"
          fullWidth
          color="red"
          onClick={confirmLinkDevice}
        >
          Подключить
        </Button>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @kupi/client lint:types`
Expected: errors about the missing `onAccountLinked` prop at call sites —
expected at this point, fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/features/list-switcher/ui/ListSwitcher.tsx
git commit -m "feat(client): add code-entry and device-link UI to ListSwitcher"
```

---

### Task 7: Propagate `onAccountLinked` down to `App.tsx`

**Files:**

- Modify: `packages/client/src/widgets/list-screen/ui/ListScreen.tsx`
- Modify: `packages/client/src/pages/list-screen/ui/ListScreenPage.tsx`
- Modify: `packages/client/src/app/App.tsx`

- [ ] **Step 1: `ListScreen.tsx` — add and forward the prop**

In `packages/client/src/widgets/list-screen/ui/ListScreen.tsx`, update the
`Props` type and the `ListSwitcher` usage:

```tsx
import { useMemo, useState } from 'react';
import type { Bootstrap, Category, List } from '@kupi/shared';
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
  onAccountLinked: (bootstrap: Bootstrap) => void;
};

export function ListScreen({
  list,
  lists,
  categories,
  onSwitchList,
  onListsChanged,
  onAccountLinked,
}: Props) {
  const { items, pendingCount, failedCount, applyChange } = useItemSync(
    list.id,
  );
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
          onAccountLinked={onAccountLinked}
        />
        <ListMenu
          list={list}
          onListsChanged={onListsChanged}
          pendingCount={pendingCount}
          failedCount={failedCount}
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

- [ ] **Step 2: `ListScreenPage.tsx` — forward the prop**

Full new contents of `packages/client/src/pages/list-screen/ui/ListScreenPage.tsx`:

```tsx
import type { Bootstrap, Category, List } from '@kupi/shared';
import { ListScreen } from '@/widgets/list-screen';

type Props = {
  list: List;
  lists: List[];
  categories: Category[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
  onAccountLinked: (bootstrap: Bootstrap) => void;
};

export function ListScreenPage({
  list,
  lists,
  categories,
  onSwitchList,
  onListsChanged,
  onAccountLinked,
}: Props) {
  return (
    <ListScreen
      list={list}
      lists={lists}
      categories={categories}
      onSwitchList={onSwitchList}
      onListsChanged={onListsChanged}
      onAccountLinked={onAccountLinked}
    />
  );
}
```

- [ ] **Step 3: `App.tsx` — implement the handler**

In `packages/client/src/app/App.tsx`, add the `Bootstrap` type import and the
handler, then pass it to `ListScreenPage`:

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Bootstrap, Category, List } from '@kupi/shared';
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

  // Редимпшн линк-кода меняет cookie этого устройства на другой аккаунт —
  // сервер уже вернул полный bootstrap, второй round-trip не нужен.
  const onAccountLinked = (bootstrap: Bootstrap): void => {
    setLists(bootstrap.lists);
    setActiveListId(bootstrap.lists[0]?.id ?? null);
    setCategories(bootstrap.categories);
  };

  const activeList = lists.find((l) => l.id === activeListId);
  if (!activeList) return null;

  return (
    <ListScreenPage
      key={activeList.id}
      list={activeList}
      lists={lists}
      categories={categories}
      onSwitchList={setActiveListId}
      onListsChanged={refreshLists}
      onAccountLinked={onAccountLinked}
    />
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @kupi/client lint:types`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/widgets/list-screen/ui/ListScreen.tsx packages/client/src/pages/list-screen/ui/ListScreenPage.tsx packages/client/src/app/App.tsx
git commit -m "feat(client): wire onAccountLinked from App down to ListSwitcher"
```

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full client test suite**

Run: `pnpm --filter @kupi/client test`
Expected: all tests pass, including the new `code-kind.test.ts`.

- [ ] **Step 2: Run all client lints**

Run: `pnpm --filter @kupi/client lint:types && pnpm --filter @kupi/client lint:arch && pnpm --filter @kupi/client lint:js`
Expected: no errors. `lint:arch` (steiger) matters most here — confirms
`ListSwitcher` still only imports through `@/entities/list` and `@/shared/ui`
public APIs (no cross-slice or deep-path violations from the new code).

- [ ] **Step 3: Manual QA in the browser**

Run: `pnpm dev`, then in a browser:

1. Open the app in one browser profile (device A), open the list menu →
   "Пригласить", copy the 8-char code.
2. Open the app in a private/incognito window (device B, fresh cookie jar),
   open the list switcher → "Ввести код", paste the code, submit.
   Expected: device B's list switcher now shows the shared list; no page
   reload needed.
3. On device A, open the list menu → "Подключить устройство", copy the
   6-char code.
4. In a third private window (device C), list switcher → "Ввести код", paste
   the 6-char code, submit. Expected: warning modal appears ("Это заменит
   аккаунт..."). Confirm. Expected: device C's screen now shows device A's
   lists.
5. Try an invalid code (e.g. `"xxx"`) in the code modal. Expected: red toast
   "Неверный код", modal stays open, no network tab entry (client-side
   rejection).
6. Try a well-formed but non-existent 8-char code. Expected: red toast after
   a network round-trip, modal stays open.

- [ ] **Step 4: Fix any issues found, re-run Steps 1–3 until clean.**

---

### Task 9: Update `CLAUDE.md`

**Files:**

- Modify: `/Users/olegkireev/projects/pet/kupi/CLAUDE.md`

Per the user's global instruction, architecture/behavior changes must be
documented in the same task that introduces them.

- [ ] **Step 1: Extend the `features/list-switcher` bullet**

Find this paragraph in the "Client design" section:

```
- **`features/list-switcher`** — the list title + `CaretDown` in the header;
  tapping it opens a Mantine `Menu` listing the user's `lists` (switch is a
  synchronous prop callback, no refetch) plus "Новый список" at the bottom,
  which opens a small `Modal` with a `TextInput` calling `createList`. It
  doesn't own the list of lists — `lists`/`activeListId` and the
  switch/refresh callbacks are all passed down from `app/App.tsx`.
```

Replace with:

```
- **`features/list-switcher`** — the list title + `CaretDown` in the header;
  tapping it opens a Mantine `Menu` listing the user's `lists` (switch is a
  synchronous prop callback, no refetch) plus "Новый список", which opens a
  small `Modal` with a `TextInput` calling `createList`, and "Ввести код",
  the receiving side of both `list-menu` share flows. `model/useListSwitcher.ts`
  (by analogy with `list-menu/model/useListMenu.ts`) owns all three modals'
  state; `model/code-kind.ts` classifies the typed code by length — 8 chars
  is a list invite (`joinList` → `POST /lists/join`), 6 is a device link code
  (`redeemLinkCode` → `POST /link`), anything else is rejected client-side
  with no network call. Redeeming a device link code shows a warning modal
  first (it replaces this device's account cookie — any lists it currently
  has become unreachable from it, recovery isn't implemented) and, on
  confirm, calls the new `onAccountLinked(bootstrap)` prop — piped down from
  `app/App.tsx` the same way `onSwitchList`/`onListsChanged` are — which
  replaces `lists`/`categories`/`activeListId` wholesale from the `Bootstrap`
  the server already returns from `POST /link`, no second round-trip.
  `400 invalid_code` from either endpoint, and a client-side-rejected code,
  surface as an `@mantine/notifications` toast (new dependency — the first
  reusable error-toast pattern in the app, mounted once in `main.tsx`). It
  doesn't own the list of lists — `lists`/`activeListId` and the
  switch/refresh callbacks are all passed down from `app/App.tsx`.
```

- [ ] **Step 2: Replace the "deferred piece" sentence**

Find, near the end of the "Client design" section:

```
other deferred piece still stands: there's no screen to redeem an
invite/link code from a shared link — only the generating side is built,
accepting a code is a separate future task.
```

Replace with:

```
other deferred piece — redeeming an invite/link code — is now built (see
`features/list-switcher` above, `docs/superpowers/specs/2026-07-02-redeem-code-design.md`).
Deep links (`?code=...` auto-opening the modal) and QR codes for device
linking are still out of scope — codes are copy-pasted by hand today — as is
recovery for a device that gets orphaned by redeeming a link code onto a
different account (`docs/backend-known-issues.md`).
```

- [ ] **Step 3: Verify the edit renders correctly**

Run: `git diff CLAUDE.md` and read it through — confirm no broken Markdown,
no contradictions with the rest of the file.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the redeem-code client flow"
```

---

## Self-Review Notes

- **Spec coverage:** code-kind classification (Task 2), `joinList`/`POST
/lists/join` flow (Tasks 3, 5, 6), `redeemLinkCode`/`POST /link` flow with
  warning modal (Tasks 3, 5, 6), `onAccountLinked` wiring (Task 7),
  `@mantine/notifications` dependency + mount (Task 1) and its use for both
  error paths (Task 5), unit test for the only pure logic (Task 2), out-of-
  scope items called out in docs (Task 9). All spec sections have a task.
- **Type consistency:** `codeKind(code: string): CodeKind` (Task 2) is
  imported and called the same way in `useListSwitcher.ts` (Task 5).
  `joinList(code: string): Promise<List>` / `redeemLinkCode(code: string):
Promise<Bootstrap>` (Task 3) match their call sites in Task 5.
  `onAccountLinked: (bootstrap: Bootstrap) => void` has the same signature at
  every layer it's threaded through (Tasks 6, 7).
