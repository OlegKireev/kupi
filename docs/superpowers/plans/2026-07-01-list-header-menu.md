# Шапка списка + меню «⋮» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в клиент шапку экрана списка — переключатель списков и меню «⋮» (пригласить, участники, подключить устройство, переименовать, удалить/выйти) — вместе с недостающими бэкенд-роутами (`DELETE /lists/:id`, `GET /lists/:id/members`), которых первый вертикальный срез не покрывал.

**Architecture:** Бэкенд: два новых роута в существующем `lists`-домене, поведение `DELETE` ветвится по роли внутри одного эндпоинта (владелец удаляет список целиком, участник — только своё членство), без нового state на клиенте для этой ветки. Клиент: два новых `features`-слайса (`list-switcher`, `list-menu`), расширение существующего `entities/list`, подъём `lists`/`activeListId` в `App.tsx` вместо одного `list`. Иконки — `@phosphor-icons/react` (решение пользователя, не текстовые символы). Полные решения — `docs/superpowers/specs/2026-07-01-list-header-menu-design.md`, этот план их реализует.

**Tech Stack:** Fastify + Kysely (уже есть), `@mantine/core` `Menu`/`Modal`/`TextInput`/`UnstyledButton` (уже установлен), `@phosphor-icons/react` (новая зависимость клиента).

**Тесты:** сервер — интеграционные тесты через `app.inject` в `lists/routes.test.ts`, по образцу уже существующих тестов домена (репозиторий отдельных тестов не имеет — как и сейчас). Клиент — по-прежнему без тестов (см. первый план: «нет логики, которую стоит покрывать»), верификация — `pnpm typecheck` + финальный ручной прогон в браузере.

---

## Файловая структура

```
packages/server/src/lists/
  repository.ts                          # + deleteList, removeListMember, countListMembers (Task 1)
  routes.ts                              # + DELETE /lists/:id (Task 2), + GET /lists/:id/members (Task 3)
  routes.test.ts                         # + тесты на оба роута (Task 2, 3)
packages/client/
  package.json                           # + @phosphor-icons/react (Task 6)
  src/
    shared/
      api/client.ts                      # + patch, del (Task 4)
      api/index.ts                       # + экспорт patch, del (Task 4)
      ui/index.ts                        # + Menu, Modal, TextInput, UnstyledButton (Task 6)
    entities/list/
      api/list-api.ts                    # + createList, renameList, deleteList, createInvite, getMemberCount (Task 5)
      index.ts                           # + экспорт новых функций (Task 5)
    features/
      list-switcher/{ui,index.ts}        # новый (Task 7)
      list-menu/{ui,api,index.ts}        # новый (Task 8)
    widgets/list-screen/ui/ListScreen.tsx  # + шапка (Task 9)
    pages/list-screen/ui/ListScreenPage.tsx # + проброс новых пропсов (Task 10)
    app/App.tsx                          # lists/activeListId вместо list (Task 10)
```

---

### Task 1: Репозиторий — `deleteList`, `removeListMember`, `countListMembers`

**Files:**
- Modify: `packages/server/src/lists/repository.ts`

- [ ] **Step 1: Добавить три функции в конец файла**

```ts
/** Удаляет список целиком (владелец): каскадом чистит items/list_invites/list_members/lists. */
export async function deleteList(db: Db, listId: string): Promise<void> {
  await db.deleteFrom('items').where('listId', '=', listId).execute();
  await db.deleteFrom('listInvites').where('listId', '=', listId).execute();
  await db.deleteFrom('listMembers').where('listId', '=', listId).execute();
  await db.deleteFrom('lists').where('id', '=', listId).execute();
}

/** Удаляет членство одного аккаунта в списке (выход участника, не владельца). */
export async function removeListMember(
  db: Db,
  listId: string,
  accountId: string,
): Promise<void> {
  await db
    .deleteFrom('listMembers')
    .where('listId', '=', listId)
    .where('accountId', '=', accountId)
    .execute();
}

/** Считает число участников списка. */
export async function countListMembers(db: Db, listId: string): Promise<number> {
  const rows = await db
    .selectFrom('listMembers')
    .select('accountId')
    .where('listId', '=', listId)
    .execute();
  return rows.length;
}
```

- [ ] **Step 2: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок (новые функции пока никем не импортируются, но должны компилироваться сами по себе).

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/lists/repository.ts
git commit -m "feat(server): add list deletion and member-count repository queries"
```

---

### Task 2: `DELETE /lists/:id`

**Files:**
- Modify: `packages/server/src/lists/routes.ts`
- Modify: `packages/server/src/lists/routes.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Добавить в конец `packages/server/src/lists/routes.test.ts`:

```ts
test('owner deletes list — gone for owner and all members', async () => {
  const app = makeApp();
  const owner = await signup(app);
  const guest = await signup(app);
  const listId = owner.bootstrap.lists[0]!.id;

  const inviteRes = await app.inject({
    method: 'POST',
    url: `/lists/${listId}/invites`,
    headers: { cookie: owner.cookie },
  });
  const { code } = inviteRes.json() as { code: string };
  await app.inject({
    method: 'POST',
    url: '/lists/join',
    headers: { cookie: guest.cookie },
    payload: { code },
  });

  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/lists/${listId}`,
    headers: { cookie: owner.cookie },
  });
  assert.equal(deleteRes.statusCode, 204);

  const ownerLists = (
    await app.inject({ method: 'GET', url: '/lists', headers: { cookie: owner.cookie } })
  ).json() as List[];
  assert.equal(ownerLists.some((l) => l.id === listId), false);

  const guestLists = (
    await app.inject({ method: 'GET', url: '/lists', headers: { cookie: guest.cookie } })
  ).json() as List[];
  assert.equal(guestLists.some((l) => l.id === listId), false);

  await app.close();
});

test('member leaves list — list still exists for owner', async () => {
  const app = makeApp();
  const owner = await signup(app);
  const guest = await signup(app);
  const listId = owner.bootstrap.lists[0]!.id;

  const inviteRes = await app.inject({
    method: 'POST',
    url: `/lists/${listId}/invites`,
    headers: { cookie: owner.cookie },
  });
  const { code } = inviteRes.json() as { code: string };
  await app.inject({
    method: 'POST',
    url: '/lists/join',
    headers: { cookie: guest.cookie },
    payload: { code },
  });

  const leaveRes = await app.inject({
    method: 'DELETE',
    url: `/lists/${listId}`,
    headers: { cookie: guest.cookie },
  });
  assert.equal(leaveRes.statusCode, 204);

  const guestLists = (
    await app.inject({ method: 'GET', url: '/lists', headers: { cookie: guest.cookie } })
  ).json() as List[];
  assert.equal(guestLists.some((l) => l.id === listId), false);

  const ownerLists = (
    await app.inject({ method: 'GET', url: '/lists', headers: { cookie: owner.cookie } })
  ).json() as List[];
  assert.equal(ownerLists.some((l) => l.id === listId), true);

  await app.close();
});

test('non-member cannot delete list (404)', async () => {
  const app = makeApp();
  const owner = await signup(app);
  const outsider = await signup(app);
  const listId = owner.bootstrap.lists[0]!.id;

  const res = await app.inject({
    method: 'DELETE',
    url: `/lists/${listId}`,
    headers: { cookie: outsider.cookie },
  });
  assert.equal(res.statusCode, 404);

  await app.close();
});
```

- [ ] **Step 2: Запустить тесты, убедиться что падают**

Run: `cd packages/server && node --import tsx --test src/lists/routes.test.ts --test-name-pattern "deletes|leaves|cannot delete"`
Expected: FAIL — `DELETE` не зарегистрирован, Fastify вернёт `404 Not Found` вместо `204`/`200`, и `some((l) => l.id === listId)` останется `true` там, где тест ждёт `false`.

- [ ] **Step 3: Реализовать роут**

В `packages/server/src/lists/routes.ts` — добавить `deleteList` и `removeListMember` в импорт из `@/lists/repository`:

```ts
import {
  deleteList,
  findListById,
  findListInviteByCode,
  findListsForAccount,
  insertList,
  insertListInvite,
  insertListMember,
  isMember,
  isOwner,
  removeListMember,
  updateListName,
} from '@/lists/repository';
```

Добавить роут в конец `listRoutes` (перед закрывающей `}`):

```ts
  // DELETE /lists/:id — владелец удаляет список целиком, участник выходит из него
  typedApp.delete(
    '/lists/:id',
    { schema: { params: ListParamsSchema } },
    async (req, reply) => {
      if (!(await isMember(app.db, req.params.id, req.accountId))) {
        return reply.code(404).send({ error: 'not_found' });
      }
      if (await isOwner(app.db, req.params.id, req.accountId)) {
        await deleteList(app.db, req.params.id);
      } else {
        await removeListMember(app.db, req.params.id, req.accountId);
      }
      return reply.code(204).send();
    },
  );
```

- [ ] **Step 4: Запустить тесты, убедиться что проходят**

Run: `cd packages/server && node --import tsx --test src/lists/routes.test.ts`
Expected: PASS — все тесты домена `lists`, включая три новых.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/lists/routes.ts packages/server/src/lists/routes.test.ts
git commit -m "feat(server): add DELETE /lists/:id (owner delete, member leave)"
```

---

### Task 3: `GET /lists/:id/members`

**Files:**
- Modify: `packages/server/src/lists/routes.ts`
- Modify: `packages/server/src/lists/routes.test.ts`

- [ ] **Step 1: Написать падающие тесты**

Добавить в конец `packages/server/src/lists/routes.test.ts`:

```ts
test('GET /lists/:id/members returns member count, grows as accounts join', async () => {
  const app = makeApp();
  const owner = await signup(app);
  const guest = await signup(app);
  const listId = owner.bootstrap.lists[0]!.id;

  const before = await app.inject({
    method: 'GET',
    url: `/lists/${listId}/members`,
    headers: { cookie: owner.cookie },
  });
  assert.deepEqual(before.json(), { count: 1 });

  const inviteRes = await app.inject({
    method: 'POST',
    url: `/lists/${listId}/invites`,
    headers: { cookie: owner.cookie },
  });
  const { code } = inviteRes.json() as { code: string };
  await app.inject({
    method: 'POST',
    url: '/lists/join',
    headers: { cookie: guest.cookie },
    payload: { code },
  });

  const after = await app.inject({
    method: 'GET',
    url: `/lists/${listId}/members`,
    headers: { cookie: owner.cookie },
  });
  assert.deepEqual(after.json(), { count: 2 });

  await app.close();
});

test('GET /lists/:id/members is 404 for non-members', async () => {
  const app = makeApp();
  const owner = await signup(app);
  const outsider = await signup(app);
  const listId = owner.bootstrap.lists[0]!.id;

  const res = await app.inject({
    method: 'GET',
    url: `/lists/${listId}/members`,
    headers: { cookie: outsider.cookie },
  });
  assert.equal(res.statusCode, 404);

  await app.close();
});
```

- [ ] **Step 2: Запустить тесты, убедиться что падают**

Run: `cd packages/server && node --import tsx --test src/lists/routes.test.ts --test-name-pattern "members"`
Expected: FAIL — `GET /lists/:id/members` не зарегистрирован, Fastify вернёт `404` с телом `{"message":"Route GET:/lists/:id/members not found",...}` вместо `{ count: N }`.

- [ ] **Step 3: Реализовать роут**

В `packages/server/src/lists/routes.ts` — добавить `countListMembers` в импорт из `@/lists/repository`, добавить роут в конец `listRoutes`:

```ts
  // GET /lists/:id/members — число участников списка (без имён, только count)
  typedApp.get(
    '/lists/:id/members',
    { schema: { params: ListParamsSchema } },
    async (req, reply) => {
      if (!(await isMember(app.db, req.params.id, req.accountId))) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return { count: await countListMembers(app.db, req.params.id) };
    },
  );
```

- [ ] **Step 4: Запустить тесты, убедиться что проходят**

Run: `cd packages/server && node --import tsx --test src/lists/routes.test.ts`
Expected: PASS — все тесты домена `lists`.

- [ ] **Step 5: Полный прогон тестов сервера**

Run: `pnpm test`
Expected: PASS — все тесты во всех доменах (включая `pretest`'s `db:verify-types`, которая должна пройти без изменений схемы БД).

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/lists/routes.ts packages/server/src/lists/routes.test.ts
git commit -m "feat(server): add GET /lists/:id/members"
```

---

### Task 4: Клиент — `patch`/`del` в `shared/api`

**Files:**
- Modify: `packages/client/src/shared/api/client.ts`
- Modify: `packages/client/src/shared/api/index.ts`

- [ ] **Step 1: Добавить `patch` и `del` в `client.ts`**

Добавить в конец `packages/client/src/shared/api/client.ts`:

```ts
export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}
```

- [ ] **Step 2: Обновить `index.ts`**

```ts
export { ApiError, del, get, patch, post } from './client';
```

- [ ] **Step 3: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/shared/api
git commit -m "feat(client): add patch and del to shared api client"
```

---

### Task 5: `entities/list` — новые запросы

**Files:**
- Modify: `packages/client/src/entities/list/api/list-api.ts`
- Modify: `packages/client/src/entities/list/index.ts`

- [ ] **Step 1: Добавить функции в `list-api.ts`**

```ts
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
  return get<{ count: number }>(`/lists/${id}/members`).then((r) => r.count);
}
```

- [ ] **Step 2: Обновить `index.ts`**

```ts
export type { List } from '@kupi/shared';
export {
  createAccount,
  createInvite,
  createList,
  deleteList,
  getLists,
  getMemberCount,
  renameList,
} from './api/list-api';
```

- [ ] **Step 3: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/entities/list
git commit -m "feat(client): add list rename/delete/invite/member-count queries"
```

---

### Task 6: Иконки Phosphor + недостающие Mantine-компоненты в `shared/ui`

**Files:**
- Modify: `packages/client/package.json` (через `pnpm add`)
- Modify: `packages/client/src/shared/ui/index.ts`

- [ ] **Step 1: Установить зависимость**

```bash
pnpm --filter @kupi/client add @phosphor-icons/react
```

- [ ] **Step 2: Добавить недостающие компоненты в `shared/ui/index.ts`**

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
```

- [ ] **Step 3: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add packages/client/package.json packages/client/src/shared/ui/index.ts pnpm-lock.yaml
git commit -m "chore(client): add @phosphor-icons/react and Menu/Modal/TextInput exports"
```

---

### Task 7: `features/list-switcher`

**Files:**
- Create: `packages/client/src/features/list-switcher/ui/ListSwitcher.tsx`
- Create: `packages/client/src/features/list-switcher/index.ts`

- [ ] **Step 1: `ui/ListSwitcher.tsx`**

`onSwitchList` — синхронное переключение между уже загруженными списками.
`onListsChanged(selectId?)` — сигнал наверх «перезапроси `GET /lists`», с
опциональным id, на который нужно переключиться после перезапроса (для только
что созданного списка, которого ещё нет в `lists` на момент вызова).

```tsx
import { useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import type { List } from '@kupi/shared';
import { createList } from '@/entities/list';
import {
  Button,
  Group,
  Menu,
  Modal,
  TextInput,
  Title,
  UnstyledButton,
} from '@/shared/ui';

type Props = {
  list: List;
  lists: List[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
};

export function ListSwitcher({ list, lists, onSwitchList, onListsChanged }: Props) {
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');

  const submitNewList = async (): Promise<void> => {
    const name = newListName.trim();
    if (!name) return;
    const created = await createList(name);
    setNewListName('');
    setNewListOpen(false);
    onListsChanged(created.id);
  };

  return (
    <>
      <Menu>
        <Menu.Target>
          <UnstyledButton>
            <Group
              gap={4}
              wrap="nowrap"
            >
              <Title
                order={1}
                size="h1"
              >
                {list.name}
              </Title>
              <CaretDown size={20} />
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
          <Menu.Item onClick={() => setNewListOpen(true)}>Новый список</Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={newListOpen}
        onClose={() => setNewListOpen(false)}
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
          onClick={() => void submitNewList()}
        >
          Создать
        </Button>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: `index.ts`**

```ts
export { ListSwitcher } from './ui/ListSwitcher';
```

- [ ] **Step 3: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/features/list-switcher
git commit -m "feat(client): add features/list-switcher slice"
```

---

### Task 8: `features/list-menu`

**Files:**
- Create: `packages/client/src/features/list-menu/api/link-code-api.ts`
- Create: `packages/client/src/features/list-menu/ui/ListMenu.tsx`
- Create: `packages/client/src/features/list-menu/index.ts`

Код подключения устройства (`POST /link-codes`) — не про списки, поэтому
живёт в этой фиче, а не в `entities/list` (по аналогии с тем, как
`features/add-item` держит свой `suggestions-api.ts`, не заводя отдельную
entity ради одного запроса).

- [ ] **Step 1: `api/link-code-api.ts`**

```ts
import { post } from '@/shared/api';

export function createLinkCode(): Promise<{ code: string }> {
  return post<{ code: string }>('/link-codes');
}
```

- [ ] **Step 2: `ui/ListMenu.tsx`**

```tsx
import { useState } from 'react';
import { Copy, DotsThreeVertical, Trash } from '@phosphor-icons/react';
import type { List } from '@kupi/shared';
import {
  createInvite,
  deleteList,
  getMemberCount,
  renameList,
} from '@/entities/list';
import {
  ActionIcon,
  Button,
  Menu,
  Modal,
  Text,
  TextInput,
} from '@/shared/ui';
import { createLinkCode } from '../api/link-code-api';

type Props = {
  list: List;
  onListsChanged: (selectId?: string) => void;
};

type CodeModalState = { title: string; code: string } | null;

export function ListMenu({ list, onListsChanged }: Props) {
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [codeModal, setCodeModal] = useState<CodeModalState>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(list.name);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const openInvite = async (): Promise<void> => {
    const { code } = await createInvite(list.id);
    setCodeModal({ title: 'Код приглашения', code });
  };

  const openLinkDevice = async (): Promise<void> => {
    const { code } = await createLinkCode();
    setCodeModal({ title: 'Код подключения устройства', code });
  };

  const openRename = (): void => {
    setRenameValue(list.name);
    setRenameOpen(true);
  };

  const submitRename = async (): Promise<void> => {
    const name = renameValue.trim();
    if (!name) return;
    await renameList(list.id, name);
    setRenameOpen(false);
    onListsChanged();
  };

  const confirmDelete = async (): Promise<void> => {
    await deleteList(list.id);
    setConfirmDeleteOpen(false);
    onListsChanged();
  };

  return (
    <>
      <Menu onOpen={() => void getMemberCount(list.id).then(setMemberCount)}>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            aria-label="Меню списка"
          >
            <DotsThreeVertical size={20} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => void openInvite()}>Пригласить</Menu.Item>
          <Menu.Item disabled>Участники ({memberCount ?? '…'})</Menu.Item>
          <Menu.Item onClick={() => void openLinkDevice()}>
            Подключить устройство
          </Menu.Item>
          <Menu.Item onClick={openRename}>Переименовать список</Menu.Item>
          <Menu.Item
            color="red"
            leftSection={<Trash size={16} />}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            Удалить/покинуть список
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={codeModal !== null}
        onClose={() => setCodeModal(null)}
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
          leftSection={<Copy size={16} />}
          onClick={() => void navigator.clipboard.writeText(codeModal?.code ?? '')}
        >
          Копировать
        </Button>
      </Modal>

      <Modal
        opened={renameOpen}
        onClose={() => setRenameOpen(false)}
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
          onClick={() => void submitRename()}
        >
          Сохранить
        </Button>
      </Modal>

      <Modal
        opened={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
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
          onClick={() => void confirmDelete()}
        >
          Подтвердить
        </Button>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: `index.ts`**

```ts
export { ListMenu } from './ui/ListMenu';
```

- [ ] **Step 4: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/features/list-menu
git commit -m "feat(client): add features/list-menu slice"
```

---

### Task 9: `widgets/list-screen` — шапка

**Files:**
- Modify: `packages/client/src/widgets/list-screen/ui/ListScreen.tsx`

- [ ] **Step 1: Заменить заголовок на `ListSwitcher` + `ListMenu`, расширить пропсы**

Заменить содержимое `packages/client/src/widgets/list-screen/ui/ListScreen.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { Category, Item, List, SyncResponse } from '@kupi/shared';
import { CategoryIcon } from '@/entities/category';
import { ItemRow, mergeItems, syncItems } from '@/entities/item';
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
    setItems([]);
    setLastSeenSeq(0);
    syncItems(list.id, { lastSeenSeq: 0, changes: [] }).then(onSynced);
  }, [list.id]);

  const toggle = useToggleItem({ listId: list.id, lastSeenSeq, onSynced });

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
      <AddItemInput
        listId={list.id}
        lastSeenSeq={lastSeenSeq}
        onSynced={onSyncedPinned}
      />
      {items.length === 0 && (
        <Text c="dimmed">
          Список пуст. Начни печатать выше — появятся подсказки из твоих частых
          покупок.
        </Text>
      )}
      <ListComponent pl={0}>
        {items.map((item) => (
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
                  listId={list.id}
                  lastSeenSeq={lastSeenSeq}
                  onSynced={onSynced}
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

Правка помимо шапки: `items`/`lastSeenSeq` теперь явно сбрасываются в
`useEffect` при смене `list.id` (переключение списка) — раньше эффект был
mount-only и никогда не менял активный список, так что старое поведение
(накопление, без сброса) не проявляло эту проблему; с появлением
переключателя списков это стало реальным кейсом.

- [ ] **Step 2: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/widgets/list-screen
git commit -m "feat(client): wire list switcher and menu into list screen header"
```

---

### Task 10: `pages/list-screen` + `app/App.tsx` — `lists`/`activeListId`

**Files:**
- Modify: `packages/client/src/pages/list-screen/ui/ListScreenPage.tsx`
- Modify: `packages/client/src/app/App.tsx`

- [ ] **Step 1: `pages/list-screen/ui/ListScreenPage.tsx`**

```tsx
import type { Category, List } from '@kupi/shared';
import { ListScreen } from '@/widgets/list-screen';

type Props = {
  list: List;
  lists: List[];
  categories: Category[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
};

export function ListScreenPage({
  list,
  lists,
  categories,
  onSwitchList,
  onListsChanged,
}: Props) {
  return (
    <ListScreen
      list={list}
      lists={lists}
      categories={categories}
      onSwitchList={onSwitchList}
      onListsChanged={onListsChanged}
    />
  );
}
```

- [ ] **Step 2: `app/App.tsx`** (заменить целиком)

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Category, List } from '@kupi/shared';
import { createAccount, createList, getLists } from '@/entities/list';
import { getCategories } from '@/entities/category';
import { ListScreenPage } from '@/pages/list-screen';
import { ApiError } from '@/shared/api';

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
        const [fetchedLists, cats] = await Promise.all([getLists(), getCategories()]);
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
        throw err;
      }
    })();
  }, []);

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

- [ ] **Step 3: Верификация**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/pages/list-screen packages/client/src/app/App.tsx
git commit -m "feat(client): lift lists/activeListId state into App for list switching"
```

---

### Task 11: Ручная сквозная проверка + обновление `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Запустить сервер и клиент**

Run: `pnpm dev:server` (отдельный терминал, порт 3000), затем `pnpm dev:client`.

- [ ] **Step 2: Проверить переключатель списков**

Открыть `http://localhost:5173`. Тап по названию списка + `▾` — открывается
меню со списком (один пункт — текущий список) и «Новый список» внизу.
Создать список с именем «Тест» — он появляется в шапке, происходит
переключение на него. Открыть переключатель снова — виден и старый, и новый
список; переключение между ними работает, товары в каждом свои.

- [ ] **Step 3: Проверить меню «⋮» — приглашение и подключение устройства**

Тап по иконке `⋮` → «Пригласить» — открывается модалка с кодом, кнопка
«Копировать» кладёт код в буфер обмена (проверить вставкой куда-нибудь).
То же для «Подключить устройство» — код из `POST /link-codes`.

- [ ] **Step 4: Проверить «Участники»**

В меню «⋮» пункт «Участники (N)» показывает `1` для списка с одним
участником (текущий аккаунт).

- [ ] **Step 5: Проверить переименование**

«⋮» → «Переименовать список» → изменить имя → сохранить. Название в шапке
обновляется.

- [ ] **Step 6: Проверить удаление последнего списка**

Удалить все списки через «⋮» → «Удалить/покинуть список» → подтвердить,
повторить для всех. После удаления последнего — автоматически появляется
новый пустой список «Мои покупки» (не белый экран).

- [ ] **Step 7: Прогнать линтеры и тесты**

Run: `pnpm lint && pnpm --filter @kupi/client fsd-lint && pnpm test`
Expected: без ошибок.

- [ ] **Step 8: Обновить `CLAUDE.md`**

В разделе «Client design» дописать под существующим описанием
`widgets/list-screen` и `pages/list-screen` + `app/App.tsx` про шапку:
`features/list-switcher` (переключение между списками пользователя +
создание нового) и `features/list-menu` (приглашение, число участников,
подключение устройства, переименование, удаление/выход — поведение
`DELETE /lists/:id` на бэкенде ветвится по роли внутри одного роута). Указать,
что иконки — `@phosphor-icons/react`, а не текстовые символы, как
предполагал исходный UI-спек. Упомянуть, что статус синка в меню и приём
инвайт-/линк-кода по ссылке сознательно отложены (см.
`docs/superpowers/specs/2026-07-01-list-header-menu-design.md`).

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document list header/menu client architecture"
```
