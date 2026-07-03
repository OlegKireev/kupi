# QR-коды и диплинки для шеринга — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить QR-код и кнопку «Поделиться» к уже существующим модалкам
кода приглашения/линковки, и научить клиент открывать соответствующую
модалку сразу с предзаполненным кодом при переходе по диплинку
(`?listCode=`/`?deviceCode=`), без похода в меню и ручного ввода.

**Architecture:** Бэкенд не меняется — оба эндпоинта (`POST /lists/join`,
`POST /link`) уже принимают голый код. На клиенте: (1) новый чистый модуль
`shared/lib/deep-link.ts` разбирает/собирает URL с кодом; (2) новый общий
компонент `shared/ui/CodeShareModal.tsx` заменяет дублирующийся JSX двух
существующих модалок кода, добавляя QR-картинку и кнопку «Поделиться»; (3)
`useListSwitcher`/`useAccountMenu` получают необязательный `initialCode`,
который на маунте открывает уже существующую модалку подтверждения с
предзаполненным кодом — новых модалок не требуется.

**Tech Stack:** React 19 + Vite (без роутера — диплинк читается из
`window.location.search` вручную), Mantine UI, `qrcode` (новая зависимость,
QR в data-URL), `@kupi/shared` (типы `Bootstrap`/`List`).

**Design doc:** `docs/superpowers/specs/2026-07-03-qr-deeplink-sharing-design.md`

---

## Известный контекст перед стартом

- Проект — pnpm-монорепа. Все клиентские команды — через
  `pnpm --filter @kupi/client <script>` из корня репозитория (см.
  `packages/client/package.json`: `test` → `vitest run`, `lint:types` →
  `tsc --noEmit`, `lint:js` → `oxlint .`, `lint:arch` → `steiger ./src`).
- `shared/lib/` в клиенте **не имеет** `index.ts` (в отличие от `shared/api`
  и `shared/config`) — файлы импортируются напрямую по пути
  (`@/shared/lib/useOnlineStatus`, и так же будет `@/shared/lib/deep-link`).
  `shared/ui/` — наоборot, обязательный баррель `index.ts`, все потребители
  импортируют только оттуда, никогда напрямую из `@mantine/core`/
  `@phosphor-icons/react` (кроме самого `shared/ui/index.ts` и файлов внутри
  `shared/ui/`, которые могут импортировать библиотеки напрямую).
- Клиентский vitest (`environment: jsdom`, конфиг —
  `packages/client/vitest.config.ts`) по проектной политике (`CLAUDE.md`)
  покрывает только чистую логику, без React Testing Library. В этой задаче
  единственная такая логика — `parseDeepLink()`.
- e2e-хелперы (`packages/e2e/tests/helpers/actions.ts`'s `shareList`,
  `openAccountMenu`, и `sharing.spec.ts`/`device-link.spec.ts`) на момент
  написания этого плана уже переписаны под текущее меню (коммит
  `0b00e35`, «test(e2e): rewrite for new menus») — `pnpm test:e2e` проходит.
  Task 7 ниже добавляет к ним ещё два теста на диплинк-флоу, используя те же
  паттерны (`browser.newContext()` на «второе устройство», чтение кода из
  `dialog`'а по regex). `shareList` читает код через
  `getByRole('dialog', { name: 'Код приглашения' }).getByText(/^[A-Z0-9]{8}$/)`
  — после Task 3 код всё ещё рендерится тем же `<Text>` внутри
  `CodeShareModal`, так что этот селектор продолжит работать без изменений;
  QR-картинка и кнопка «Поделиться» не совпадают с regex и не мешают.

## Карта файлов

| Файл | Что делает |
| --- | --- |
| `packages/client/package.json` | + зависимость `qrcode`, dev-зависимость `@types/qrcode` |
| `packages/client/src/shared/lib/deep-link.ts` | **новый.** `parseDeepLink`/`buildDeepLink`, чистая логика |
| `packages/client/src/shared/lib/deep-link.test.ts` | **новый.** Тест на `parseDeepLink` |
| `packages/client/src/shared/ui/CodeShareModal.tsx` | **новый.** Общая модалка: QR + код + «Копировать» + «Поделиться» |
| `packages/client/src/shared/ui/index.ts` | + экспорт `CodeShareModal`; − `CopyIcon`/`QrCodeIcon` (последние потребители удаляются в Task 4–5) |
| `packages/client/src/features/list-switcher/model/useListSwitcher.ts` | `openInvite` считает `url`; новые `initialCode`/`onDeepLinkConsumed` |
| `packages/client/src/features/list-switcher/ui/ListSwitcher.tsx` | Инвайт-модалка → `CodeShareModal`; пробрасывает `initialCode`/`onDeepLinkConsumed` |
| `packages/client/src/features/account-menu/model/useAccountMenu.ts` | `openLinkDevice` считает `url`; новые `initialCode`/`onDeepLinkConsumed` |
| `packages/client/src/features/account-menu/ui/AccountMenu.tsx` | Модалка кода → `CodeShareModal`; удаляется пункт «QR-код (скоро)» |
| `packages/client/src/app/App.tsx` | Разбор `window.location.search` один раз при старте, состояние `deepLink`, проброс вниз |
| `packages/client/src/pages/list-screen/ui/ListScreenPage.tsx` | Транзитный проброс новых пропов |
| `packages/client/src/widgets/list-screen/ui/ListScreen.tsx` | Транзитный проброс + разводка `initialListCode`/`initialDeviceCode` по `ListSwitcher`/`AccountMenu` |
| `packages/e2e/tests/deep-link-sharing.spec.ts` | **новый.** Playwright-тесты на оба диплинк-флоу |

---

### Task 1: Зависимость `qrcode`

**Files:**
- Modify: `packages/client/package.json`

- [ ] **Step 1: Установить зависимости**

```bash
pnpm --filter @kupi/client add qrcode
pnpm --filter @kupi/client add -D @types/qrcode
```

- [ ] **Step 2: Проверить package.json**

Открыть `packages/client/package.json` и убедиться, что появились:

```json
"dependencies": {
  ...
  "qrcode": "^1.5.4"
},
```

```json
"devDependencies": {
  ...
  "@types/qrcode": "^1.5.6"
}
```

(Точные версии зафиксирует `pnpm add` в `pnpm-lock.yaml` — важно, что записи
появились в правильных секциях, а не точные патч-номера.)

- [ ] **Step 3: Commit**

```bash
git add packages/client/package.json pnpm-lock.yaml
git commit -m "chore(client): add qrcode dependency for code-sharing QR"
```

---

### Task 2: `shared/lib/deep-link.ts` (TDD)

**Files:**
- Create: `packages/client/src/shared/lib/deep-link.ts`
- Test: `packages/client/src/shared/lib/deep-link.test.ts`

- [ ] **Step 1: Написать падающий тест**

Создать `packages/client/src/shared/lib/deep-link.test.ts`:

```ts
import { expect, test } from 'vitest';

import { parseDeepLink } from './deep-link';

test('parses a list invite code', () => {
  expect(parseDeepLink('?listCode=A1B2C3D4')).toEqual({
    kind: 'list',
    code: 'A1B2C3D4',
  });
});

test('parses a device link code', () => {
  expect(parseDeepLink('?deviceCode=A1B2C3')).toEqual({
    kind: 'device',
    code: 'A1B2C3',
  });
});

test('prefers listCode when both params are present', () => {
  expect(parseDeepLink('?listCode=A1B2C3D4&deviceCode=A1B2C3')).toEqual({
    kind: 'list',
    code: 'A1B2C3D4',
  });
});

test('returns null when neither param is present', () => {
  expect(parseDeepLink('')).toBeNull();
});

test('returns null for an empty listCode value', () => {
  expect(parseDeepLink('?listCode=')).toBeNull();
});

test('returns null for an empty deviceCode value', () => {
  expect(parseDeepLink('?deviceCode=')).toBeNull();
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `pnpm --filter @kupi/client exec vitest run src/shared/lib/deep-link.test.ts`
Expected: FAIL — `Cannot find module './deep-link'` (файл ещё не создан).

- [ ] **Step 3: Реализовать `deep-link.ts`**

Создать `packages/client/src/shared/lib/deep-link.ts`:

```ts
export type DeepLink = { kind: 'list' | 'device'; code: string };

/** Разбирает `window.location.search` на код инвайта/линковки. */
export function parseDeepLink(search: string): DeepLink | null {
  const params = new URLSearchParams(search);
  const listCode = params.get('listCode');
  if (listCode) {
    return { kind: 'list', code: listCode };
  }
  const deviceCode = params.get('deviceCode');
  if (deviceCode) {
    return { kind: 'device', code: deviceCode };
  }
  return null;
}

/** Собирает диплинк-URL из текущего origin для QR/кнопки «Поделиться». */
export function buildDeepLink(kind: 'list' | 'device', code: string): string {
  const param = kind === 'list' ? 'listCode' : 'deviceCode';
  return `${window.location.origin}/?${param}=${code}`;
}
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `pnpm --filter @kupi/client exec vitest run src/shared/lib/deep-link.test.ts`
Expected: PASS (6 тестов)

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/shared/lib/deep-link.ts packages/client/src/shared/lib/deep-link.test.ts
git commit -m "feat(client): add deep-link parsing for invite/link codes"
```

---

### Task 3: `shared/ui/CodeShareModal.tsx`

**Files:**
- Create: `packages/client/src/shared/ui/CodeShareModal.tsx`
- Modify: `packages/client/src/shared/ui/index.ts`

- [ ] **Step 1: Создать компонент**

Создать `packages/client/src/shared/ui/CodeShareModal.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Button, Modal, Text } from '@mantine/core';
import { CopyIcon, ShareIcon } from '@phosphor-icons/react';
import QRCode from 'qrcode';

type Props = {
  opened: boolean;
  onClose: () => void;
  title: string;
  url: string;
  code: string;
};

/**
 * Общая модалка для обеих генерирующих сторон шеринга (инвайт в список,
 * линковка устройства) — QR сверху, код текстом снизу, «Копировать»
 * (копирует полную ссылку, не голый код) и «Поделиться» (если у браузера
 * есть Web Share API).
 */
export function CodeShareModal({ opened, onClose, title, url, code }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setQrDataUrl(null);
    let cancelled = false;
    void QRCode.toDataURL(url).then((dataUrl) => {
      if (!cancelled) {
        setQrDataUrl(dataUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [opened, url]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
    >
      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt="QR-код"
          width={200}
          height={200}
          style={{ display: 'block', margin: '0 auto 16px' }}
        />
      )}
      <Text
        size="xl"
        fw={700}
        ta="center"
      >
        {code}
      </Text>
      <Button
        mt="md"
        fullWidth
        leftSection={<CopyIcon size={16} />}
        onClick={() => navigator.clipboard.writeText(url)}
      >
        Копировать
      </Button>
      {typeof navigator.share === 'function' && (
        <Button
          mt="sm"
          fullWidth
          variant="light"
          leftSection={<ShareIcon size={16} />}
          onClick={() => navigator.share({ url })}
        >
          Поделиться
        </Button>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Добавить экспорт в `shared/ui/index.ts`**

Открыть `packages/client/src/shared/ui/index.ts`, добавить после блока
`export { notifications } from '@mantine/notifications';`:

```ts
export { CodeShareModal } from './CodeShareModal';
```

- [ ] **Step 3: Проверить типы**

Run: `pnpm --filter @kupi/client lint:types`
Expected: без ошибок (компонент пока нигде не используется, но должен
компилироваться сам по себе)

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/shared/ui/CodeShareModal.tsx packages/client/src/shared/ui/index.ts
git commit -m "feat(client): add CodeShareModal (QR + share) shared component"
```

---

### Task 4: Подключить `CodeShareModal` и диплинк в `list-switcher`

**Files:**
- Modify: `packages/client/src/features/list-switcher/model/useListSwitcher.ts`
- Modify: `packages/client/src/features/list-switcher/ui/ListSwitcher.tsx`

- [ ] **Step 1: Обновить `useListSwitcher.ts`**

Заменить весь файл `packages/client/src/features/list-switcher/model/useListSwitcher.ts` на:

```ts
import { useEffect, useRef, useState } from 'react';

import type { List } from '@kupi/shared';

import {
  createInvite,
  createList,
  deleteList,
  getMemberCount,
  joinList,
  renameList,
} from '@/entities/list';
import { ApiError } from '@/shared/api';
import { buildDeepLink } from '@/shared/lib/deep-link';
import { useOnlineStatus } from '@/shared/lib/useOnlineStatus';
import { notifications } from '@/shared/ui';
import { getSyncStatusText } from './sync-status';

type Params = {
  list: List;
  onListsChanged: (selectId?: string) => void;
  pendingCount: number;
  failedCount: number;
  initialCode?: string;
  onDeepLinkConsumed: () => void;
};

type InviteModalState = { title: string; code: string; url: string } | null;

const INVALID_CODE_MESSAGE = 'Неверный код';

export function useListSwitcher({
  list,
  onListsChanged,
  pendingCount,
  failedCount,
  initialCode,
  onDeepLinkConsumed,
}: Params) {
  const online = useOnlineStatus();
  const syncStatusText = getSyncStatusText(pendingCount, failedCount, online);

  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [inviteModal, setInviteModal] = useState<InviteModalState>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(list.name);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeValue, setCodeValue] = useState('');

  // Диплинк (?listCode=...) предзаполняет и открывает ту же модалку, что
  // открыл бы ручной ввод — тап по «Продолжить» и есть подтверждение.
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current || !initialCode) {
      return;
    }
    deepLinkConsumed.current = true;
    setCodeValue(initialCode);
    setCodeOpen(true);
    onDeepLinkConsumed();
  }, [initialCode, onDeepLinkConsumed]);

  const loadMemberCount = (): void => {
    void getMemberCount(list.id).then(setMemberCount);
  };

  const openInvite = async (): Promise<void> => {
    const { code } = await createInvite(list.id);
    setInviteModal({
      title: 'Код приглашения',
      code,
      url: buildDeepLink('list', code),
    });
  };

  const closeInviteModal = (): void => setInviteModal(null);

  const openRename = (): void => {
    setRenameValue(list.name);
    setRenameOpen(true);
  };
  const closeRename = (): void => setRenameOpen(false);

  const submitRename = async (): Promise<void> => {
    const name = renameValue.trim();
    if (!name) {
      return;
    }
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

  const openNewList = (): void => setNewListOpen(true);
  const closeNewList = (): void => setNewListOpen(false);

  const submitNewList = async (): Promise<void> => {
    const name = newListName.trim();
    if (!name) {
      return;
    }
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

  return {
    syncStatusText,
    memberCount,
    loadMemberCount,
    inviteModal,
    openInvite,
    closeInviteModal,
    renameOpen,
    renameValue,
    setRenameValue,
    openRename,
    closeRename,
    submitRename,
    confirmDeleteOpen,
    openConfirmDelete,
    closeConfirmDelete,
    confirmDelete,
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
  };
}
```

- [ ] **Step 2: Обновить `ListSwitcher.tsx`**

Заменить весь файл `packages/client/src/features/list-switcher/ui/ListSwitcher.tsx` на:

```tsx
import type { List } from '@kupi/shared';

import {
  Button,
  CaretDownIcon,
  CheckIcon,
  CodeShareModal,
  FilePlusIcon,
  Group,
  KeyIcon,
  Menu,
  Modal,
  Text,
  TextboxIcon,
  TextInput,
  Title,
  TrashIcon,
  UnstyledButton,
  UserPlusIcon,
  UsersFourIcon,
} from '@/shared/ui';
import { useListSwitcher } from '../model/useListSwitcher';
import styles from './styles.module.css';

type Props = {
  list: List;
  lists: List[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
  pendingCount: number;
  failedCount: number;
  initialCode?: string;
  onDeepLinkConsumed: () => void;
};

export function ListSwitcher({
  list,
  lists,
  onSwitchList,
  onListsChanged,
  pendingCount,
  failedCount,
  initialCode,
  onDeepLinkConsumed,
}: Props) {
  const {
    syncStatusText,
    memberCount,
    loadMemberCount,
    inviteModal,
    openInvite,
    closeInviteModal,
    renameOpen,
    renameValue,
    setRenameValue,
    openRename,
    closeRename,
    submitRename,
    confirmDeleteOpen,
    openConfirmDelete,
    closeConfirmDelete,
    confirmDelete,
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
  } = useListSwitcher({
    list,
    onListsChanged,
    pendingCount,
    failedCount,
    initialCode,
    onDeepLinkConsumed,
  });

  return (
    <>
      <Menu onOpen={loadMemberCount}>
        <Menu.Target>
          <UnstyledButton className={styles.menuTrigger}>
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
              <CaretDownIcon
                size={20}
                className={styles.caretIcon}
              />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{syncStatusText}</Menu.Label>
          <Menu.Item
            leftSection={<UserPlusIcon size={16} />}
            onClick={openInvite}
          >
            Пригласить в список
          </Menu.Item>
          <Menu.Item
            disabled
            leftSection={<UsersFourIcon size={16} />}
          >
            Участники ({memberCount ?? '…'})
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
          <Menu.Divider />
          {lists.map((l) => (
            <Menu.Item
              key={l.id}
              rightSection={l.id === list.id ? <CheckIcon size={16} /> : null}
              onClick={() => onSwitchList(l.id)}
            >
              {l.name}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item
            leftSection={<FilePlusIcon size={16} />}
            onClick={openNewList}
          >
            Новый список
          </Menu.Item>
          <Menu.Item
            leftSection={<KeyIcon size={16} />}
            onClick={openCode}
          >
            Присоединиться по коду списка
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <CodeShareModal
        opened={inviteModal !== null}
        onClose={closeInviteModal}
        title={inviteModal?.title ?? ''}
        url={inviteModal?.url ?? ''}
        code={inviteModal?.code ?? ''}
      />

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
        title="Присоединиться по коду списка"
      >
        <TextInput
          value={codeValue}
          onChange={(e) => setCodeValue(e.currentTarget.value)}
          placeholder="Код приглашения"
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
    </>
  );
}
```

Обратите внимание: `CopyIcon` больше не импортируется напрямую в этом файле
(теперь внутри `CodeShareModal`) — но пока не убираем его из
`shared/ui/index.ts`, он ещё нужен `AccountMenu.tsx` до Task 5.

- [ ] **Step 3: Проверить типы и линт**

Run: `pnpm --filter @kupi/client lint:types && pnpm --filter @kupi/client lint:js`
Expected: без ошибок

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/features/list-switcher
git commit -m "feat(client): wire CodeShareModal and deep-link join into list-switcher"
```

---

### Task 5: Подключить `CodeShareModal` и диплинк в `account-menu`, убрать заглушку QR

**Files:**
- Modify: `packages/client/src/features/account-menu/model/useAccountMenu.ts`
- Modify: `packages/client/src/features/account-menu/ui/AccountMenu.tsx`
- Modify: `packages/client/src/shared/ui/index.ts`

- [ ] **Step 1: Обновить `useAccountMenu.ts`**

Заменить весь файл `packages/client/src/features/account-menu/model/useAccountMenu.ts` на:

```ts
import { useEffect, useRef, useState } from 'react';

import type { Bootstrap } from '@kupi/shared';

import { redeemLinkCode } from '@/entities/list';
import { ApiError } from '@/shared/api';
import { buildDeepLink } from '@/shared/lib/deep-link';
import { notifications } from '@/shared/ui';
import { createLinkCode } from '../api/link-code-api';

type Params = {
  onAccountLinked: (bootstrap: Bootstrap) => Promise<void>;
  initialCode?: string;
  onDeepLinkConsumed: () => void;
};

type CodeModalState = { title: string; code: string; url: string } | null;

const INVALID_CODE_MESSAGE = 'Неверный код';

export function useAccountMenu({
  onAccountLinked,
  initialCode,
  onDeepLinkConsumed,
}: Params) {
  const [codeModal, setCodeModal] = useState<CodeModalState>(null);
  const [deviceCodeOpen, setDeviceCodeOpen] = useState(false);
  const [deviceCodeValue, setDeviceCodeValue] = useState('');
  const [pendingLinkCode, setPendingLinkCode] = useState<string | null>(null);

  // Диплинк (?deviceCode=...) пропускает шаг ручного ввода и сразу
  // открывает предупреждающую модалку — та же логика, что и после
  // submitDeviceCode(), просто код известен заранее.
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current || !initialCode) {
      return;
    }
    deepLinkConsumed.current = true;
    setPendingLinkCode(initialCode);
    onDeepLinkConsumed();
  }, [initialCode, onDeepLinkConsumed]);

  const openLinkDevice = async (): Promise<void> => {
    const { code } = await createLinkCode();
    setCodeModal({
      title: 'Код подключения устройства',
      code,
      url: buildDeepLink('device', code),
    });
  };

  const closeCodeModal = (): void => setCodeModal(null);

  const openDeviceCode = (): void => {
    setDeviceCodeValue('');
    setDeviceCodeOpen(true);
  };
  const closeDeviceCode = (): void => setDeviceCodeOpen(false);

  const submitDeviceCode = (): void => {
    setPendingLinkCode(deviceCodeValue);
    setDeviceCodeOpen(false);
  };

  const cancelLinkDevice = (): void => {
    setPendingLinkCode(null);
    setDeviceCodeOpen(true);
  };

  const confirmLinkDevice = async (): Promise<void> => {
    const code = pendingLinkCode;
    if (!code) {
      return;
    }
    try {
      const bootstrap = await redeemLinkCode(code);
      setPendingLinkCode(null);
      await onAccountLinked(bootstrap);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setPendingLinkCode(null);
        setDeviceCodeOpen(true);
        notifications.show({ color: 'red', message: INVALID_CODE_MESSAGE });
        return;
      }
      throw err;
    }
  };

  return {
    codeModal,
    closeCodeModal,
    openLinkDevice,
    deviceCodeOpen,
    deviceCodeValue,
    setDeviceCodeValue,
    openDeviceCode,
    closeDeviceCode,
    submitDeviceCode,
    pendingLinkCode,
    cancelLinkDevice,
    confirmLinkDevice,
  };
}
```

- [ ] **Step 2: Обновить `AccountMenu.tsx`**

Заменить весь файл `packages/client/src/features/account-menu/ui/AccountMenu.tsx` на:

```tsx
import type { Bootstrap } from '@kupi/shared';

import {
  ActionIcon,
  Button,
  CodeShareModal,
  Menu,
  Modal,
  Text,
  TextInput,
  DevicesIcon,
  KeyIcon,
  UserCircleIcon,
} from '@/shared/ui';
import { useAccountMenu } from '../model/useAccountMenu';

type Props = {
  onAccountLinked: (bootstrap: Bootstrap) => Promise<void>;
  initialCode?: string;
  onDeepLinkConsumed: () => void;
};

export function AccountMenu({
  onAccountLinked,
  initialCode,
  onDeepLinkConsumed,
}: Props) {
  const {
    codeModal,
    closeCodeModal,
    openLinkDevice,
    deviceCodeOpen,
    deviceCodeValue,
    setDeviceCodeValue,
    openDeviceCode,
    closeDeviceCode,
    submitDeviceCode,
    pendingLinkCode,
    cancelLinkDevice,
    confirmLinkDevice,
  } = useAccountMenu({ onAccountLinked, initialCode, onDeepLinkConsumed });

  return (
    <>
      <Menu>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            aria-label="Меню аккаунта"
          >
            <UserCircleIcon size={20} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<DevicesIcon size={16} />}
            onClick={openLinkDevice}
          >
            Подключить это устройство
          </Menu.Item>
          <Menu.Item
            leftSection={<KeyIcon size={16} />}
            onClick={openDeviceCode}
          >
            Ввести код устройства
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <CodeShareModal
        opened={codeModal !== null}
        onClose={closeCodeModal}
        title={codeModal?.title ?? ''}
        url={codeModal?.url ?? ''}
        code={codeModal?.code ?? ''}
      />

      <Modal
        opened={deviceCodeOpen}
        onClose={closeDeviceCode}
        title="Ввести код устройства"
      >
        <TextInput
          value={deviceCodeValue}
          onChange={(e) => setDeviceCodeValue(e.currentTarget.value)}
          placeholder="Код подключения устройства"
          data-autofocus
        />
        <Button
          mt="md"
          fullWidth
          leftSection={<KeyIcon size={16} />}
          onClick={submitDeviceCode}
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
          Это заменит аккаунт этого устройства. Текущие списки станут
          недоступны с него. Продолжить?
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

Пункт меню «QR-код (скоро)» (`disabled`, `QrCodeIcon`) удалён — QR теперь
встроен прямо в модалку «Подключить это устройство».

- [ ] **Step 3: Убрать неиспользуемые иконки из `shared/ui/index.ts`**

Открыть `packages/client/src/shared/ui/index.ts`. Второй `export` (иконки из
`@phosphor-icons/react`) сейчас выглядит так:

```ts
export {
  CaretDownIcon,
  CheckIcon,
  CopyIcon,
  KeyIcon,
  QrCodeIcon,
  TrashIcon,
  UserCircleIcon,
  UserPlusIcon,
  UsersFourIcon,
  DevicesIcon,
  TextboxIcon,
  DotsThreeVerticalIcon,
  FilePlusIcon,
} from '@phosphor-icons/react';
```

Убрать `CopyIcon` и `QrCodeIcon` (после Task 4–5 у них больше нет
потребителей — `ListSwitcher.tsx`/`AccountMenu.tsx` теперь используют
`CodeShareModal`, которая импортирует `CopyIcon` напрямую из
`@phosphor-icons/react`, а не через этот реэкспорт):

```ts
export {
  CaretDownIcon,
  CheckIcon,
  KeyIcon,
  TrashIcon,
  UserCircleIcon,
  UserPlusIcon,
  UsersFourIcon,
  DevicesIcon,
  TextboxIcon,
  DotsThreeVerticalIcon,
  FilePlusIcon,
} from '@phosphor-icons/react';
```

- [ ] **Step 4: Проверить типы, линт и архитектуру**

Run: `pnpm --filter @kupi/client lint:types && pnpm --filter @kupi/client lint:js && pnpm --filter @kupi/client lint:arch`
Expected: без ошибок (в частности, `lint:js`/`tsc` должны подтвердить, что
нигде не осталось неиспользуемых импортов `CopyIcon`/`QrCodeIcon`)

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/features/account-menu packages/client/src/shared/ui/index.ts
git commit -m "feat(client): wire CodeShareModal and deep-link linking into account-menu"
```

---

### Task 6: Разбор диплинка в `App.tsx` и проброс через `ListScreenPage`/`ListScreen`

**Files:**
- Modify: `packages/client/src/app/App.tsx`
- Modify: `packages/client/src/pages/list-screen/ui/ListScreenPage.tsx`
- Modify: `packages/client/src/widgets/list-screen/ui/ListScreen.tsx`

- [ ] **Step 1: Обновить `App.tsx`**

Заменить весь файл `packages/client/src/app/App.tsx` на:

```tsx
import { useEffect, useRef, useState } from 'react';

import type { Bootstrap, Category, List } from '@kupi/shared';

import { getCategories } from '@/entities/category';
import { clearListCache } from '@/entities/item';
import { createAccount, createList, getLists } from '@/entities/list';
import { ListScreenPage } from '@/pages/list-screen';
import { ApiError } from '@/shared/api';
import { parseDeepLink, type DeepLink } from '@/shared/lib/deep-link';
import {
  loadBootstrapCache,
  saveBootstrapCache,
} from './model/bootstrap-cache';

export function App() {
  const [lists, setLists] = useState<List[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deepLink, setDeepLink] = useState<DeepLink | null>(null);
  const bootstrapped = useRef(false);
  const deepLinkParsed = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) {
      return;
    }
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

  // Диплинк (?listCode=.../?deviceCode=...) читается один раз при старте —
  // тот же useRef-guard, что и у bootstrap-эффекта, против двойного вызова
  // в React StrictMode. URL сбрасывается целиком (других query-параметров у
  // приложения сейчас нет), чтобы обновление страницы не открывало модалку
  // повторно.
  useEffect(() => {
    if (deepLinkParsed.current) {
      return;
    }
    deepLinkParsed.current = true;
    const parsed = parseDeepLink(window.location.search);
    if (parsed) {
      setDeepLink(parsed);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (lists.length > 0) {
      saveBootstrapCache(lists, categories);
    }
  }, [lists, categories]);

  // Общий сеттер lists/activeListId с fallback-логикой: если список
  // оказался пуст (после удаления/выхода, либо у только что привязанного
  // аккаунта), заводит список по умолчанию — тот же паттерн, что при
  // онбординге нового аккаунта, вместо молчаливого опустошения экрана.
  const applyLists = async (
    fetchedLists: List[],
    selectId?: string,
  ): Promise<void> => {
    const nextLists =
      fetchedLists.length === 0
        ? [await createList('Мои покупки')]
        : fetchedLists;
    setLists(nextLists);
    setActiveListId((current) => {
      const preferred = selectId ?? current;
      return preferred && nextLists.some((l) => l.id === preferred)
        ? preferred
        : nextLists[0]!.id;
    });
  };

  // Перезапрашивает GET /lists после мутации (создание/переименование/удаление
  // списка) — не hot path, ручной патч состояния не нужен.
  const refreshLists = async (selectId?: string): Promise<void> => {
    await applyLists(await getLists(), selectId);
  };

  // Редимпшн линк-кода меняет cookie этого устройства на другой аккаунт —
  // сервер уже вернул полный bootstrap, второй round-trip не нужен. Списки
  // старого аккаунта больше не будут перечитаны, поэтому их localStorage-кеш
  // (`kupi:list:<id>`) чистим здесь, иначе он остаётся в хранилище навсегда.
  const onAccountLinked = async (bootstrap: Bootstrap): Promise<void> => {
    lists.forEach((l) => clearListCache(l.id));
    await applyLists(bootstrap.lists);
    setCategories(bootstrap.categories);
  };

  const activeList = lists.find((l) => l.id === activeListId);
  if (!activeList) {
    return null;
  }

  return (
    <ListScreenPage
      key={activeList.id}
      list={activeList}
      lists={lists}
      categories={categories}
      onSwitchList={setActiveListId}
      onListsChanged={refreshLists}
      onAccountLinked={onAccountLinked}
      initialListCode={deepLink?.kind === 'list' ? deepLink.code : undefined}
      initialDeviceCode={
        deepLink?.kind === 'device' ? deepLink.code : undefined
      }
      onDeepLinkConsumed={() => setDeepLink(null)}
    />
  );
}
```

- [ ] **Step 2: Обновить `ListScreenPage.tsx`**

Заменить весь файл `packages/client/src/pages/list-screen/ui/ListScreenPage.tsx` на:

```tsx
import type { Bootstrap, Category, List } from '@kupi/shared';

import { ListScreen } from '@/widgets/list-screen';

type Props = {
  list: List;
  lists: List[];
  categories: Category[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
  onAccountLinked: (bootstrap: Bootstrap) => Promise<void>;
  initialListCode?: string;
  initialDeviceCode?: string;
  onDeepLinkConsumed: () => void;
};

export function ListScreenPage({
  list,
  lists,
  categories,
  onSwitchList,
  onListsChanged,
  onAccountLinked,
  initialListCode,
  initialDeviceCode,
  onDeepLinkConsumed,
}: Props) {
  return (
    <ListScreen
      list={list}
      lists={lists}
      categories={categories}
      onSwitchList={onSwitchList}
      onListsChanged={onListsChanged}
      onAccountLinked={onAccountLinked}
      initialListCode={initialListCode}
      initialDeviceCode={initialDeviceCode}
      onDeepLinkConsumed={onDeepLinkConsumed}
    />
  );
}
```

- [ ] **Step 3: Обновить `ListScreen.tsx`**

Заменить весь файл `packages/client/src/widgets/list-screen/ui/ListScreen.tsx` на:

```tsx
import { useMemo, useState } from 'react';

import type { Bootstrap, Category, List } from '@kupi/shared';

import { CategoryIcon } from '@/entities/category';
import { ItemRow, useItemSync } from '@/entities/item';
import { AccountMenu } from '@/features/account-menu';
import { AddItemInput } from '@/features/add-item';
import { ItemEditor } from '@/features/edit-item';
import { ListSwitcher } from '@/features/list-switcher';
import { useToggleItem } from '@/features/toggle-item';
import { Group, List as ListComponent, Stack, Text } from '@/shared/ui';

type Props = {
  list: List;
  lists: List[];
  categories: Category[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
  onAccountLinked: (bootstrap: Bootstrap) => Promise<void>;
  initialListCode?: string;
  initialDeviceCode?: string;
  onDeepLinkConsumed: () => void;
};

export function ListScreen({
  list,
  lists,
  categories,
  onSwitchList,
  onListsChanged,
  onAccountLinked,
  initialListCode,
  initialDeviceCode,
  onDeepLinkConsumed,
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
          pendingCount={pendingCount}
          failedCount={failedCount}
          initialCode={initialListCode}
          onDeepLinkConsumed={onDeepLinkConsumed}
        />
        <AccountMenu
          onAccountLinked={onAccountLinked}
          initialCode={initialDeviceCode}
          onDeepLinkConsumed={onDeepLinkConsumed}
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

- [ ] **Step 4: Проверить типы, линт, архитектуру и юнит-тесты всего пакета**

```bash
pnpm --filter @kupi/client lint:types
pnpm --filter @kupi/client lint:js
pnpm --filter @kupi/client lint:arch
pnpm --filter @kupi/client test
```

Expected: все четыре — без ошибок.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/app/App.tsx packages/client/src/pages/list-screen/ui/ListScreenPage.tsx packages/client/src/widgets/list-screen/ui/ListScreen.tsx
git commit -m "feat(client): parse deep link on boot and open matching modal"
```

---

### Task 7: E2E-тесты диплинк-флоу

`pnpm test:e2e` уже рабочий (см. «Известный контекст» выше) и уже покрывает
ручной ввод обоих кодов (`sharing.spec.ts`, `device-link.spec.ts`). Этот
таск добавляет два теста на сам диплинк — переход по `?listCode=`/
`?deviceCode=` вместо похода в меню и вставки кода вручную. Паттерн —
`browser.newContext()` для «второго устройства», как в уже существующих
тестах.

**Files:**
- Create: `packages/e2e/tests/deep-link-sharing.spec.ts`

- [ ] **Step 1: Написать тесты**

Создать `packages/e2e/tests/deep-link-sharing.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { addItem, openAccountMenu, openListSwitcher } from './helpers/actions';

test('opening a list invite link on a second device auto-opens the join dialog, pre-filled', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await owner.goto('/');
  await addItem(owner, 'Хлеб');

  await openListSwitcher(owner, 'Мои покупки');
  await owner.getByRole('menuitem', { name: 'Пригласить в список' }).click();
  const inviteDialog = owner.getByRole('dialog', { name: 'Код приглашения' });
  await expect(
    inviteDialog.getByRole('img', { name: 'QR-код' }),
  ).toBeVisible();
  const inviteCode = await inviteDialog
    .getByText(/^[A-Z0-9]{8}$/)
    .innerText();
  await owner.keyboard.press('Escape');

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/?listCode=${inviteCode}`);

  const joinDialog = guest.getByRole('dialog', {
    name: 'Присоединиться по коду списка',
  });
  await expect(joinDialog).toBeVisible();
  await expect(guest.getByPlaceholder('Код приглашения')).toHaveValue(
    inviteCode,
  );
  await joinDialog.getByRole('button', { name: 'Продолжить' }).click();

  await expect(guest.getByRole('checkbox', { name: 'Хлеб' })).toBeVisible();

  // диплинк-параметр сбрасывается из URL при обработке — reload не должен
  // открыть модалку повторно
  await guest.reload();
  await expect(
    guest.getByRole('dialog', { name: 'Присоединиться по коду списка' }),
  ).toBeHidden();

  await ownerContext.close();
  await guestContext.close();
});

test('opening a device link on a fresh browser skips straight to the warning dialog', async ({
  browser,
}) => {
  const primaryContext = await browser.newContext();
  const primary = await primaryContext.newPage();
  await primary.goto('/');
  await addItem(primary, 'Сыр');

  await openAccountMenu(primary);
  await primary
    .getByRole('menuitem', { name: 'Подключить это устройство' })
    .click();
  const linkCode = await primary
    .getByRole('dialog', { name: 'Код подключения устройства' })
    .getByText(/^[A-Z0-9]{6}$/)
    .innerText();

  const secondaryContext = await browser.newContext();
  const secondary = await secondaryContext.newPage();
  await secondary.goto(`/?deviceCode=${linkCode}`);

  // диплинк пропускает шаг ручного ввода — сразу предупреждающая модалка,
  // без промежуточного «Ввести код устройства»
  const warningDialog = secondary.getByRole('dialog', {
    name: 'Подключить устройство?',
  });
  await expect(warningDialog).toBeVisible();
  await warningDialog.getByRole('button', { name: 'Подключить' }).click();

  await expect(secondary.getByRole('checkbox', { name: 'Сыр' })).toBeVisible();

  await primaryContext.close();
  await secondaryContext.close();
});
```

- [ ] **Step 2: Установить браузер Playwright, если ещё не установлен**

Run: `pnpm --filter @kupi/e2e exec playwright install chromium`
Expected: без ошибок (может быть no-op, если уже установлен раньше)

- [ ] **Step 3: Запустить e2e-suite**

Run: `pnpm test:e2e`
Expected: PASS — все тесты, включая два новых из
`deep-link-sharing.spec.ts` и все ранее существующие
(`sharing.spec.ts`, `device-link.spec.ts`, `sharing-sync.spec.ts`,
`multi-list.spec.ts`, и прочие в `packages/e2e/tests/`).

- [ ] **Step 4: Commit**

```bash
git add packages/e2e/tests/deep-link-sharing.spec.ts
git commit -m "test(e2e): cover list/device deep-link auto-open flows"
```

---

### Task 8: Ручная проверка кнопки «Поделиться»

Единственное, что e2e не проверяет: `navigator.share` в headless Chromium
(Playwright) недоступен так же, как и в большинстве desktop-браузеров —
автоматическая проверка присутствия/поведения кнопки «Поделиться» ничего не
скажет о реальном мобильном сценарии. Короткая ручная проверка, без кода.

**Files:** нет.

- [ ] **Step 1: Поднять дев-сервер**

```bash
pnpm dev
```

- [ ] **Step 2: Проверить на мобильном окружении (если доступно)**

Открыть `http://<адрес-машины>:5173` с телефона в той же сети (или через
devtools' mobile emulation с поддержкой Web Share API, если такое
окружение есть под рукой) → «Пригласить в список» → убедиться, что рядом с
«Копировать» появилась кнопка «Поделиться», и тап по ней открывает
системный share sheet. Если мобильного окружения нет под рукой — пропустить
этот шаг, отметить как непроверенное (известное ограничение окружения, не
блокер, поведение уже покрыто условным рендерингом `typeof
navigator.share === 'function'` в `CodeShareModal`).

- [ ] **Step 3: Погасить дев-сервер**

Остановить процесс `pnpm dev` (Ctrl+C или `kill` PID) — не оставлять
висящие процессы после задачи.

---

## Итоговая проверка перед завершением

```bash
pnpm --filter @kupi/client lint:types
pnpm --filter @kupi/client lint:js
pnpm --filter @kupi/client lint:arch
pnpm --filter @kupi/client test
pnpm test:e2e
```

Все пять команд должны пройти без ошибок.
