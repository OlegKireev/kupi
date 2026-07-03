# List Header Menu Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the client's list-header menu into two domains — list actions (merged into the existing title dropdown) and account/device actions (a new `UserCircleIcon` menu) — replacing the current ambiguous `⋮` menu, per `docs/superpowers/specs/2026-07-03-list-header-menu-redesign-design.md`.

**Architecture:** `features/list-menu` is deleted; its list-scoped items (invite, members, rename, delete, sync status) move into `features/list-switcher`'s single `Menu`, separated from the list-switching items by `Menu.Divider`. A new `features/account-menu` slice takes over device-linking (create + redeem link code), which used to live split across `list-menu` and `list-switcher`. `code-kind.ts` (length-based code-type guessing) is deleted — each code input is now domain-specific.

**Tech Stack:** React + Mantine (`Menu`, `Modal`), `@phosphor-icons/react`, Vitest (pure-logic tests only, matching this project's existing convention of not testing hooks/UI).

---

## File Structure

| File | Change |
|---|---|
| `packages/client/src/shared/ui/index.ts` | add `UserCircleIcon`, `QrCodeIcon`, `CheckIcon` exports; remove `DotsThreeVerticalIcon` |
| `packages/client/src/features/list-switcher/model/sync-status.ts` + `.test.ts` | moved here unchanged from `features/list-menu/model/` |
| `packages/client/src/features/list-switcher/model/useListSwitcher.ts` | rewritten: absorbs `useListMenu`'s state/handlers, drops device-link branch |
| `packages/client/src/features/list-switcher/model/code-kind.ts` + `.test.ts` | deleted |
| `packages/client/src/features/list-switcher/ui/ListSwitcher.tsx` | rewritten: one `Menu` with list-actions section + divider + other-lists (active highlighted) + divider + new-list/join-by-code |
| `packages/client/src/features/account-menu/api/link-code-api.ts` | moved unchanged from `features/list-menu/api/` |
| `packages/client/src/features/account-menu/model/useAccountMenu.ts` | new — device link-code creation + redeem/confirm flow (ported from `useListSwitcher`'s device branch) |
| `packages/client/src/features/account-menu/ui/AccountMenu.tsx` | new — `UserCircleIcon` menu |
| `packages/client/src/features/account-menu/index.ts` | new |
| `packages/client/src/features/list-menu/` (whole directory) | deleted |
| `packages/client/src/widgets/list-screen/ui/ListScreen.tsx` | swap `ListMenu` for `AccountMenu`, move `pendingCount`/`failedCount` props to `ListSwitcher`, move `onAccountLinked` prop to `AccountMenu` |

---

### Task 1: Add new icons, keep old one for now

**Files:**
- Modify: `packages/client/src/shared/ui/index.ts`

- [ ] **Step 1: Add `UserCircleIcon`, `QrCodeIcon`, `CheckIcon` to the re-export**

Current relevant block:

```ts
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

Replace with:

```ts
export {
  CaretDownIcon,
  CheckIcon,
  CopyIcon,
  DotsThreeVerticalIcon,
  KeyIcon,
  QrCodeIcon,
  TrashIcon,
  UserCircleIcon,
  UserPlusIcon,
  UsersFourIcon,
  DevicesIcon,
  TextboxIcon,
  ListIcon,
  FilePlusIcon,
} from '@phosphor-icons/react';
```

(`DotsThreeVerticalIcon` is removed later in Task 8, once `ListMenu.tsx` — its only consumer — is deleted.)

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @kupi/client lint:types`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/shared/ui/index.ts
git commit -m "feat(client): export UserCircleIcon, QrCodeIcon, CheckIcon"
```

---

### Task 2: Move sync-status to list-switcher

**Files:**
- Move: `packages/client/src/features/list-menu/model/sync-status.ts` → `packages/client/src/features/list-switcher/model/sync-status.ts`
- Move: `packages/client/src/features/list-menu/model/sync-status.test.ts` → `packages/client/src/features/list-switcher/model/sync-status.test.ts`

- [ ] **Step 1: Move both files with git mv (preserves history, no content changes — both files only import/export relative to their own directory, so no import paths need updating)**

```bash
git mv packages/client/src/features/list-menu/model/sync-status.ts packages/client/src/features/list-switcher/model/sync-status.ts
git mv packages/client/src/features/list-menu/model/sync-status.test.ts packages/client/src/features/list-switcher/model/sync-status.test.ts
```

- [ ] **Step 2: Run the test at its new location**

Run: `pnpm --filter @kupi/client test -- sync-status`
Expected: 4 passing tests (`everything synced and no failures`, `pending changes while online`, `pending changes while offline`, `failed changes take priority over pending/online state`).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor(client): move sync-status into list-switcher"
```

---

### Task 3: Create the `account-menu` feature slice

**Files:**
- Move: `packages/client/src/features/list-menu/api/link-code-api.ts` → `packages/client/src/features/account-menu/api/link-code-api.ts`
- Create: `packages/client/src/features/account-menu/model/useAccountMenu.ts`
- Create: `packages/client/src/features/account-menu/ui/AccountMenu.tsx`
- Create: `packages/client/src/features/account-menu/index.ts`

- [ ] **Step 1: Move the link-code API function (content unchanged)**

```bash
mkdir -p packages/client/src/features/account-menu/api
git mv packages/client/src/features/list-menu/api/link-code-api.ts packages/client/src/features/account-menu/api/link-code-api.ts
```

Content (unchanged, confirm it still reads):

```ts
import { post } from '@/shared/api';

export function createLinkCode(): Promise<{ code: string }> {
  return post<{ code: string }>('/link-codes');
}
```

- [ ] **Step 2: Write `useAccountMenu.ts`**

This is the device-link half of the current `useListSwitcher` (the `codeKind === 'device'` branch) plus `useListMenu`'s `openLinkDevice`, combined under one hook:

```ts
import { useState } from 'react';

import type { Bootstrap } from '@kupi/shared';

import { redeemLinkCode } from '@/entities/list';
import { ApiError } from '@/shared/api';
import { notifications } from '@/shared/ui';
import { createLinkCode } from '../api/link-code-api';

type Params = {
  onAccountLinked: (bootstrap: Bootstrap) => Promise<void>;
};

type CodeModalState = { title: string; code: string } | null;

const INVALID_CODE_MESSAGE = 'Неверный код';

export function useAccountMenu({ onAccountLinked }: Params) {
  const [codeModal, setCodeModal] = useState<CodeModalState>(null);
  const [deviceCodeOpen, setDeviceCodeOpen] = useState(false);
  const [deviceCodeValue, setDeviceCodeValue] = useState('');
  const [pendingLinkCode, setPendingLinkCode] = useState<string | null>(null);

  const openLinkDevice = async (): Promise<void> => {
    const { code } = await createLinkCode();
    setCodeModal({ title: 'Код подключения устройства', code });
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

- [ ] **Step 3: Write `AccountMenu.tsx`**

```tsx
import type { Bootstrap } from '@kupi/shared';

import {
  ActionIcon,
  Button,
  Menu,
  Modal,
  Text,
  TextInput,
  CopyIcon,
  DevicesIcon,
  KeyIcon,
  QrCodeIcon,
  UserCircleIcon,
} from '@/shared/ui';
import { useAccountMenu } from '../model/useAccountMenu';

type Props = {
  onAccountLinked: (bootstrap: Bootstrap) => Promise<void>;
};

export function AccountMenu({ onAccountLinked }: Props) {
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
  } = useAccountMenu({ onAccountLinked });

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
          <Menu.Item
            disabled
            leftSection={<QrCodeIcon size={16} />}
          >
            QR-код (скоро)
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

- [ ] **Step 4: Write `index.ts`**

```ts
export { AccountMenu } from './ui/AccountMenu';
```

- [ ] **Step 5: Typecheck (expect errors — `ListScreen.tsx` still imports the now-partially-dismantled old slices; that's fixed in Task 7)**

Run: `pnpm --filter @kupi/client lint:types`
Expected: pre-existing errors only in files not yet touched (`useListSwitcher.ts` still references `codeKind`/`onAccountLinked` — untouched until Task 4). No errors inside the new `account-menu` files themselves.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/features/account-menu
git add packages/client/src/features/list-menu/api
git commit -m "feat(client): add account-menu feature for device linking"
```

---

### Task 4: Rewrite `useListSwitcher`, delete `code-kind` and `useListMenu`

**Files:**
- Modify: `packages/client/src/features/list-switcher/model/useListSwitcher.ts`
- Delete: `packages/client/src/features/list-switcher/model/code-kind.ts`
- Delete: `packages/client/src/features/list-switcher/model/code-kind.test.ts`
- Delete: `packages/client/src/features/list-menu/model/useListMenu.ts`

- [ ] **Step 1: Delete `code-kind.ts` and its test — no longer needed now that list-code and device-code entry are two separate inputs in two separate menus**

```bash
git rm packages/client/src/features/list-switcher/model/code-kind.ts
git rm packages/client/src/features/list-switcher/model/code-kind.test.ts
```

- [ ] **Step 2: Delete `useListMenu.ts` (its state/handlers are folded into `useListSwitcher` in the next step)**

```bash
git rm packages/client/src/features/list-menu/model/useListMenu.ts
```

- [ ] **Step 3: Rewrite `useListSwitcher.ts`**

Merges `useListMenu`'s list-scoped state (member count, invite, rename, delete, sync status) into this hook. Drops the device-link branch (moved to `useAccountMenu` in Task 3) — `submitCode` no longer needs `codeKind`, it always resolves as a list-join code. `onAccountLinked` is no longer a parameter.

```ts
import { useState } from 'react';

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
import { useOnlineStatus } from '@/shared/lib/useOnlineStatus';
import { notifications } from '@/shared/ui';
import { getSyncStatusText } from './sync-status';

type Params = {
  list: List;
  onListsChanged: (selectId?: string) => void;
  pendingCount: number;
  failedCount: number;
};

type InviteModalState = { title: string; code: string } | null;

const INVALID_CODE_MESSAGE = 'Неверный код';

export function useListSwitcher({
  list,
  onListsChanged,
  pendingCount,
  failedCount,
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

  const loadMemberCount = (): void => {
    void getMemberCount(list.id).then(setMemberCount);
  };

  const openInvite = async (): Promise<void> => {
    const { code } = await createInvite(list.id);
    setInviteModal({ title: 'Код приглашения', code });
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

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(client): merge list-menu logic into useListSwitcher"
```

(Typecheck still fails at this point — `ListSwitcher.tsx` and `ListScreen.tsx` haven't been updated for the new hook shape yet. That's expected; it's fixed by Task 5 and Task 7.)

---

### Task 5: Rewrite `ListSwitcher.tsx`

**Files:**
- Modify: `packages/client/src/features/list-switcher/ui/ListSwitcher.tsx`

- [ ] **Step 1: Replace the whole file**

One `Menu`: sync status + current-list actions, divider, other lists (active one marked with a `CheckIcon`), divider, new-list/join-by-code. `onAccountLinked` prop is gone (moved to `AccountMenu`). `pendingCount`/`failedCount` are new props (moved from `ListMenu`).

```tsx
import type { List } from '@kupi/shared';

import {
  Button,
  CaretDownIcon,
  CheckIcon,
  CopyIcon,
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

type Props = {
  list: List;
  lists: List[];
  onSwitchList: (id: string) => void;
  onListsChanged: (selectId?: string) => void;
  pendingCount: number;
  failedCount: number;
};

export function ListSwitcher({
  list,
  lists,
  onSwitchList,
  onListsChanged,
  pendingCount,
  failedCount,
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
  } = useListSwitcher({ list, onListsChanged, pendingCount, failedCount });

  return (
    <>
      <Menu onOpen={loadMemberCount}>
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

      <Modal
        opened={inviteModal !== null}
        onClose={closeInviteModal}
        title={inviteModal?.title}
      >
        <Text
          size="xl"
          fw={700}
          ta="center"
        >
          {inviteModal?.code}
        </Text>
        <Button
          mt="md"
          fullWidth
          leftSection={<CopyIcon size={16} />}
          onClick={() => navigator.clipboard.writeText(inviteModal?.code ?? '')}
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

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/features/list-switcher/ui/ListSwitcher.tsx
git commit -m "feat(client): merge list actions into the list-switcher menu"
```

---

### Task 6: Delete the rest of `features/list-menu`

**Files:**
- Delete: `packages/client/src/features/list-menu/ui/ListMenu.tsx`
- Delete: `packages/client/src/features/list-menu/index.ts`

- [ ] **Step 1: Confirm nothing else remains in the directory**

Run: `find packages/client/src/features/list-menu -type f`
Expected: only `ui/ListMenu.tsx` and `index.ts` (everything else was moved out in Tasks 2–4).

- [ ] **Step 2: Delete the directory**

```bash
git rm -r packages/client/src/features/list-menu
```

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(client): delete features/list-menu, superseded by list-switcher + account-menu"
```

---

### Task 7: Wire `AccountMenu` into `ListScreen`

**Files:**
- Modify: `packages/client/src/widgets/list-screen/ui/ListScreen.tsx`

- [ ] **Step 1: Update imports and the header `Group`**

Current:

```tsx
import { ListMenu } from '@/features/list-menu';
import { ListSwitcher } from '@/features/list-switcher';
```

```tsx
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
```

Replace with:

```tsx
import { AccountMenu } from '@/features/account-menu';
import { ListSwitcher } from '@/features/list-switcher';
```

```tsx
        <ListSwitcher
          list={list}
          lists={lists}
          onSwitchList={onSwitchList}
          onListsChanged={onListsChanged}
          pendingCount={pendingCount}
          failedCount={failedCount}
        />
        <AccountMenu onAccountLinked={onAccountLinked} />
```

- [ ] **Step 2: Typecheck — should be clean now**

Run: `pnpm --filter @kupi/client lint:types`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/widgets/list-screen/ui/ListScreen.tsx
git commit -m "feat(client): wire AccountMenu into the list-screen header"
```

---

### Task 8: Drop the now-unused `DotsThreeVerticalIcon` export

**Files:**
- Modify: `packages/client/src/shared/ui/index.ts`

- [ ] **Step 1: Confirm it has no remaining consumers**

Run: `grep -rn "DotsThreeVerticalIcon" packages/client/src`
Expected: only the one line inside `shared/ui/index.ts` itself.

- [ ] **Step 2: Remove it from the re-export**

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
  ListIcon,
  FilePlusIcon,
} from '@phosphor-icons/react';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @kupi/client lint:types`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/shared/ui/index.ts
git commit -m "refactor(client): drop unused DotsThreeVerticalIcon export"
```

---

### Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run every client check**

```bash
pnpm --filter @kupi/client lint:types
pnpm --filter @kupi/client lint:arch
pnpm --filter @kupi/client lint:js
pnpm --filter @kupi/client test
```

Expected: all pass. `lint:arch` (steiger) matters here specifically — `account-menu` is a new feature-layer slice and must only import from `entities`/`shared`, never from `list-switcher` (same-layer cross-import, forbidden by `fsd/no-cross-imports`); this plan's `useAccountMenu.ts` only imports `@/entities/list`, `@/shared/api`, `@/shared/ui`, so it should already satisfy this.

- [ ] **Step 2: Manual smoke test in a real browser**

This is a header/navigation change — per project convention, verify it actually works before calling it done, not just typecheck/lint.

```bash
pnpm dev
```

Open the app (default `http://localhost:5173`, check the actual port Vite prints) and, using the browser (Playwright MCP tools are available — `browser_navigate`, `browser_snapshot`, `browser_click` — or manual clicking):

1. Click the list title. Confirm the dropdown shows, top to bottom: sync status label, "Пригласить в список", "Участники (N)", "Переименовать список", "Удалить/покинуть список", a divider, the other lists with the current one marked by a checkmark, a divider, "Новый список", "Присоединиться по коду списка".
2. Click the `UserCircleIcon` in the header. Confirm a separate dropdown shows "Подключить это устройство", "Ввести код устройства", and a disabled "QR-код (скоро)".
3. Exercise one flow from each menu end-to-end: rename the list (via the list dropdown) and generate a device link code (via the account dropdown) — confirm both still work exactly as before the refactor.
4. Stop the dev server afterward (`Ctrl+C` or kill the background process) — don't leave it running.

- [ ] **Step 3: No commit for this task** — it's verification only. If Step 2 surfaces a bug, fix it as part of whichever Task introduced it and re-run this task.
