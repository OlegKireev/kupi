# e2e Playwright Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `packages/e2e` pnpm workspace with Playwright tests that
drive the real client against a real server (dedicated ports + a throwaway
tmp SQLite file) and cover the app's main user flows: bootstrap + item CRUD,
multi-list management, sharing via invite code, device linking via link code,
and the offline-sync queue.

**Architecture:** Two tiny infra edits (`DB_PATH` env var for the server,
`VITE_API_PROXY_TARGET` env var for the client's Vite proxy) let Playwright's
`webServer` config boot isolated server+client instances on ports 3100/5174
instead of colliding with `pnpm dev`'s 3000/5173. One accessibility fix
(`aria-label` on `ItemRow`'s edit-toggle button) gives tests a stable locator
for the one icon-only button in the app that currently has none. Tests are
flat spec files (no Page Object Model — one screen, it'd be a needless
abstraction) sharing a small `tests/helpers/actions.ts` of interaction
helpers. No DB reset between tests: every fresh `BrowserContext` has no
`kupi_dt` cookie, so the client's existing 401→`POST /api/accounts` bootstrap
flow gives each test its own isolated account for free.

**Tech Stack:** `@playwright/test` (Chromium only), reusing the existing
Fastify server and Vite dev client unmodified except for the two env-var
edits above.

**Spec:** `docs/superpowers/specs/2026-07-02-e2e-playwright-design.md`

---

### Task 1: Make the server's SQLite path configurable via `DB_PATH`

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Read `DB_PATH` from the environment**

`packages/server/src/index.ts` currently opens the DB with no argument
(defaulting to the hardcoded `'kupi.db'` inside `openSqlite`, see
`packages/server/src/db/connection.ts:8`). Change the call site only —
`openSqlite`'s default parameter already handles `undefined`:

```ts
import { buildApp } from '@/app';
import { openSqlite } from '@/db/connection';

const sqlite = openSqlite(process.env.DB_PATH);
const app = buildApp(sqlite);
```

- [ ] **Step 2: Verify nothing broke**

Run: `pnpm --filter @kupi/server lint:types && pnpm --filter @kupi/server test`
Expected: both pass, unchanged from before this edit (no test covers
`index.ts` directly — this is a type-check + regression guard, not new
coverage).

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat(server): make sqlite path configurable via DB_PATH"
```

---

### Task 2: Make the client's `/api` proxy target configurable via `VITE_API_PROXY_TARGET`

**Files:**
- Modify: `packages/client/vite.config.ts`

- [ ] **Step 1: Read the proxy target from the environment**

`packages/client/vite.config.ts` currently hardcodes the proxy target.
Change:

```ts
  server: {
    proxy: {
      '^/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
```

to:

```ts
  server: {
    proxy: {
      '^/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
```

- [ ] **Step 2: Verify nothing broke**

Run: `pnpm --filter @kupi/client lint:types`
Expected: passes.

Run: `pnpm dev:server` in one terminal, then `pnpm dev:client` in another,
open `http://localhost:5173` — app loads and bootstraps a list as before
(unset `VITE_API_PROXY_TARGET` falls back to the old hardcoded default).
Stop both dev servers afterward.

- [ ] **Step 3: Commit**

```bash
git add packages/client/vite.config.ts
git commit -m "feat(client): make the dev proxy target configurable via VITE_API_PROXY_TARGET"
```

---

### Task 3: Add an `aria-label` to `ItemRow`'s edit-toggle button

**Files:**
- Modify: `packages/client/src/entities/item/ui/ItemRow.tsx`

- [ ] **Step 1: Add the label**

`packages/client/src/entities/item/ui/ItemRow.tsx` currently has:

```tsx
        <ActionIcon
          ml="auto"
          variant="gradient"
          onClick={onOpen}
        >
          <ListIcon />
        </ActionIcon>
```

This is the only icon-only interactive element in the app without an
accessible name (every other icon button already has one — see
`ListMenu.tsx`'s `aria-label="Меню списка"` for the same pattern). Change to:

```tsx
        <ActionIcon
          ml="auto"
          variant="gradient"
          aria-label={`Редактировать ${item.name}`}
          onClick={onOpen}
        >
          <ListIcon />
        </ActionIcon>
```

- [ ] **Step 2: Verify nothing broke**

Run: `pnpm --filter @kupi/client lint:types`
Expected: passes. (No existing test touches `ItemRow` — full behavioral
verification happens once the e2e suite exercises it in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/entities/item/ui/ItemRow.tsx
git commit -m "fix(client): add aria-label to the item row's edit-toggle button"
```

---

### Task 4: Scaffold the `@kupi/e2e` workspace

**Files:**
- Create: `packages/e2e/package.json`
- Create: `packages/e2e/tsconfig.json`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@kupi/e2e",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "lint:types": "tsc --noEmit"
  },
  "devDependencies": {
    "@playwright/test": "^1.61.1",
    "@types/node": "^26.0.1"
  }
}
```

(`@types/node` version pinned to match `packages/server/package.json`'s
existing pin, for consistency.)

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "noEmit": true
  },
  "include": ["tests", "playwright.config.ts", "global-teardown.ts"]
}
```

- [ ] **Step 3: Install the workspace member and the Chromium browser binary**

Run: `pnpm install`
Expected: `packages/e2e` shows up in the workspace, lockfile updates, no
errors.

Run: `pnpm --filter @kupi/e2e exec playwright install chromium`
Expected: downloads the Chromium binary Playwright drives (one-time, not
part of `pnpm install` — Playwright ships browsers separately from the npm
package).

- [ ] **Step 4: Commit**

```bash
git add packages/e2e/package.json packages/e2e/tsconfig.json pnpm-lock.yaml
git commit -m "chore(e2e): scaffold the @kupi/e2e Playwright workspace"
```

---

### Task 5: Playwright config, isolated tmp DB, and teardown

**Files:**
- Create: `packages/e2e/tests/tmp-db.ts`
- Create: `packages/e2e/global-teardown.ts`
- Create: `packages/e2e/playwright.config.ts`

- [ ] **Step 1: Write the shared tmp-db-path module**

`playwright.config.ts` and `global-teardown.ts` both need the exact same
path, computed once per run. A tiny shared module guarantees that (both
import it in the same Node process, so the module only evaluates once):

```ts
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Computed once at import time — playwright.config.ts and
// global-teardown.ts both import this module, so they agree on the same
// path without passing it through an env var.
export const tmpDbPath = path.join(tmpdir(), `kupi-e2e-${randomUUID()}.db`);
```

- [ ] **Step 2: Write the global teardown**

```ts
import { rm } from 'node:fs/promises';

import { tmpDbPath } from './tests/tmp-db';

export default async function globalTeardown(): Promise<void> {
  await Promise.all(
    ['', '-wal', '-shm', '-journal'].map((suffix) =>
      rm(`${tmpDbPath}${suffix}`, { force: true }),
    ),
  );
}
```

- [ ] **Step 3: Write `playwright.config.ts`**

```ts
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { tmpDbPath } from './tests/tmp-db';

const repoRoot = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  testDir: './tests',
  globalTeardown: './global-teardown.ts',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @kupi/server dev',
      url: 'http://localhost:3100/api/health',
      cwd: repoRoot,
      reuseExistingServer: false,
      env: { PORT: '3100', DB_PATH: tmpDbPath },
    },
    {
      command: 'pnpm --filter @kupi/client dev -- --port 5174',
      url: 'http://localhost:5174',
      cwd: repoRoot,
      reuseExistingServer: false,
      env: { VITE_API_PROXY_TARGET: 'http://localhost:3100' },
    },
  ],
});
```

`reuseExistingServer: false` on both entries is deliberate, not
boilerplate: it's what stops Playwright from ever attaching to whatever
`pnpm dev` happens to be running (see the design doc's rationale) — a
leftover process on 3100 from a previous crashed run would otherwise get
reused against a fresh run's (different) `tmpDbPath`, corrupting the run.

- [ ] **Step 4: Verify the servers boot**

Create a placeholder spec temporarily to sanity-check the config end to end:

`packages/e2e/tests/smoke.spec.ts` (temporary — Task 7 replaces this file's
content with real coverage, keep this step's file until then only as a
manual check):

```ts
import { expect, test } from '@playwright/test';

test('the app boots on the isolated e2e ports', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();
});
```

Run: `pnpm --filter @kupi/e2e test`
Expected: PASS — Playwright boots the server on :3100 and the client on
:5174, the fresh browser context has no cookie, the client bootstraps a new
account with its default "Мои покупки" list.

- [ ] **Step 5: Commit**

```bash
git add packages/e2e/tests/tmp-db.ts packages/e2e/global-teardown.ts packages/e2e/playwright.config.ts packages/e2e/tests/smoke.spec.ts
git commit -m "feat(e2e): add playwright config with isolated ports and tmp db"
```

---

### Task 6: Shared interaction helpers

**Files:**
- Create: `packages/e2e/tests/helpers/actions.ts`
- Delete: `packages/e2e/tests/smoke.spec.ts` (superseded by Task 7)

- [ ] **Step 1: Write the helpers**

```ts
import { expect, type Page } from '@playwright/test';

export async function addItem(page: Page, name: string): Promise<void> {
  const input = page.getByPlaceholder('Добавить товар');
  await input.fill(name);
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name })).toBeVisible();
}

export async function toggleItem(page: Page, name: string): Promise<void> {
  await page.getByRole('checkbox', { name }).click();
}

export async function openEditor(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: `Редактировать ${name}` }).click();
}

export async function setQuantity(page: Page, delta: number): Promise<void> {
  const label = delta > 0 ? 'Увеличить количество' : 'Уменьшить количество';
  const button = page.getByRole('button', { name: label });
  for (let i = 0; i < Math.abs(delta); i++) {
    await button.click();
  }
}

export async function pickCategory(page: Page, chipLabel: string): Promise<void> {
  await page.getByText(chipLabel, { exact: true }).click();
}

export async function deleteItem(page: Page, name: string): Promise<void> {
  await openEditor(page, name);
  await page.getByRole('button', { name: 'Удалить' }).click();
}

export async function openListMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Меню списка' }).click();
}

export async function openListSwitcher(page: Page, currentListName: string): Promise<void> {
  await page.getByRole('button', { name: currentListName }).click();
}
```

- [ ] **Step 2: Remove the smoke-test placeholder**

```bash
git rm packages/e2e/tests/smoke.spec.ts
```

- [ ] **Step 3: Verify types**

Run: `pnpm --filter @kupi/e2e lint:types`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add packages/e2e/tests/helpers/actions.ts
git commit -m "feat(e2e): add shared interaction helpers"
```

---

### Task 7: `list-crud.spec.ts` — bootstrap, add/autocomplete, check, edit, delete

**Files:**
- Create: `packages/e2e/tests/list-crud.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from '@playwright/test';

import {
  addItem,
  deleteItem,
  openEditor,
  pickCategory,
  setQuantity,
  toggleItem,
} from './helpers/actions';

test('a fresh device bootstraps an account with a default list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();
});

test('add (with autocomplete), check, edit quantity/category, and delete an item', async ({ page }) => {
  await page.goto('/');

  await addItem(page, 'Молоко');

  // adding an item feeds item_frequency — re-typing a prefix now suggests it
  const input = page.getByPlaceholder('Добавить товар');
  await input.fill('Мол');
  await expect(page.getByRole('option', { name: /Молоко/ })).toBeVisible();
  await input.fill('');

  await toggleItem(page, 'Молоко');
  await expect(page.getByRole('checkbox', { name: 'Молоко' })).toBeChecked();
  await toggleItem(page, 'Молоко');
  await expect(page.getByRole('checkbox', { name: 'Молоко' })).not.toBeChecked();

  await openEditor(page, 'Молоко');
  await setQuantity(page, 2); // 1 -> 3
  await expect(page.getByText('3', { exact: true })).toBeVisible();
  await pickCategory(page, '🥛 Молочное');
  await expect(page.getByRole('radio', { name: '🥛 Молочное' })).toBeChecked();

  await deleteItem(page, 'Молоко');
  await expect(page.getByRole('checkbox', { name: 'Молоко' })).toHaveCount(0);
});
```

- [ ] **Step 2: Run and verify**

Run: `pnpm --filter @kupi/e2e test list-crud.spec.ts`
Expected: PASS. This is coverage-verification of already-implemented
behavior, not TDD — if a locator doesn't match, open the HTML report
(`pnpm --filter @kupi/e2e exec playwright show-report`) or run with
`--headed --debug` to inspect the actual accessible names/roles Mantine
renders, and adjust the locator in this spec (not the app) unless the
report reveals a genuine app bug.

- [ ] **Step 3: Commit**

```bash
git add packages/e2e/tests/list-crud.spec.ts
git commit -m "test(e2e): cover bootstrap and item CRUD"
```

---

### Task 8: `multi-list.spec.ts` — create, switch, rename, delete/leave, fallback list

**Files:**
- Create: `packages/e2e/tests/multi-list.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from '@playwright/test';

import { openListMenu, openListSwitcher } from './helpers/actions';

test('create a list, switch between lists, rename, then delete back to another existing list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();

  await openListSwitcher(page, 'Мои покупки');
  await page.getByRole('menuitem', { name: 'Новый список' }).click();
  await page.getByPlaceholder('Название списка').fill('Дача');
  await page.getByRole('button', { name: 'Создать' }).click();
  await expect(page.getByRole('button', { name: 'Дача' })).toBeVisible();

  await openListSwitcher(page, 'Дача');
  await page.getByRole('menuitem', { name: 'Мои покупки' }).click();
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();

  await openListSwitcher(page, 'Мои покупки');
  await page.getByRole('menuitem', { name: 'Дача' }).click();
  await expect(page.getByRole('button', { name: 'Дача' })).toBeVisible();

  await openListMenu(page);
  await page.getByRole('menuitem', { name: 'Переименовать список' }).click();
  const renameDialog = page.getByRole('dialog', { name: 'Переименовать список' });
  await renameDialog.getByRole('textbox').fill('Дача 2.0');
  await renameDialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('button', { name: 'Дача 2.0' })).toBeVisible();

  await openListMenu(page);
  await page.getByRole('menuitem', { name: 'Удалить/покинуть список' }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Удалить/покинуть список?' });
  await deleteDialog.getByRole('button', { name: 'Подтвердить' }).click();

  // "Дача 2.0" is gone, the untouched default list is still there
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();
});

test('deleting the last remaining list falls back to a fresh default list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();

  await openListMenu(page);
  await page.getByRole('menuitem', { name: 'Удалить/покинуть список' }).click();
  await page
    .getByRole('dialog', { name: 'Удалить/покинуть список?' })
    .getByRole('button', { name: 'Подтвердить' })
    .click();

  // App.tsx's refreshLists() creates a fresh "Мои покупки" list when none remain
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();
});
```

- [ ] **Step 2: Run and verify**

Run: `pnpm --filter @kupi/e2e test multi-list.spec.ts`
Expected: PASS. Same note as Task 7 about adjusting locators from the
actual DOM, not the app, if something doesn't match.

- [ ] **Step 3: Commit**

```bash
git add packages/e2e/tests/multi-list.spec.ts
git commit -m "test(e2e): cover multi-list create/switch/rename/delete and fallback list"
```

---

### Task 9: `sharing.spec.ts` — invite code (valid, malformed, well-formed-but-unknown)

**Files:**
- Create: `packages/e2e/tests/sharing.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from '@playwright/test';

import { addItem, openListMenu, openListSwitcher } from './helpers/actions';

test('an invite code shares a list, including its existing items, with a second device', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await owner.goto('/');
  await addItem(owner, 'Хлеб');

  await openListMenu(owner);
  await owner.getByRole('menuitem', { name: 'Пригласить' }).click();
  const inviteCode = await owner
    .getByRole('dialog', { name: 'Код приглашения' })
    .getByText(/^[A-Z0-9]{8}$/)
    .innerText();
  expect(inviteCode).toHaveLength(8);

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto('/');
  await openListSwitcher(guest, 'Мои покупки');
  await guest.getByRole('menuitem', { name: 'Ввести код' }).click();
  await guest.getByPlaceholder('Код приглашения или устройства').fill(inviteCode);
  await guest.getByRole('button', { name: 'Продолжить' }).click();

  await expect(guest.getByRole('checkbox', { name: 'Хлеб' })).toBeVisible();

  await ownerContext.close();
  await guestContext.close();
});

test('a malformed code is rejected client-side with no network round-trip', async ({ page }) => {
  await page.goto('/');
  await openListSwitcher(page, 'Мои покупки');
  await page.getByRole('menuitem', { name: 'Ввести код' }).click();
  // 5 chars: neither an 8-char invite code nor a 6-char link code
  await page.getByPlaceholder('Код приглашения или устройства').fill('SHORT');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByText('Неверный код')).toBeVisible();
});

test('a well-formed but unissued invite code is rejected by the server with the same toast', async ({ page }) => {
  await page.goto('/');
  await openListSwitcher(page, 'Мои покупки');
  await page.getByRole('menuitem', { name: 'Ввести код' }).click();
  await page.getByPlaceholder('Код приглашения или устройства').fill('ZZZZZZZZ');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByText('Неверный код')).toBeVisible();
});
```

- [ ] **Step 2: Run and verify**

Run: `pnpm --filter @kupi/e2e test sharing.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/e2e/tests/sharing.spec.ts
git commit -m "test(e2e): cover list sharing via invite code"
```

---

### Task 10: `device-link.spec.ts` — link code with the account-swap warning

**Files:**
- Create: `packages/e2e/tests/device-link.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from '@playwright/test';

import { addItem, openListMenu, openListSwitcher } from './helpers/actions';

test('a link code warns before replacing the second device\'s account, then swaps it', async ({ browser }) => {
  const primaryContext = await browser.newContext();
  const primary = await primaryContext.newPage();
  await primary.goto('/');
  await addItem(primary, 'Сыр');

  await openListMenu(primary);
  await primary.getByRole('menuitem', { name: 'Подключить устройство' }).click();
  const linkCode = await primary
    .getByRole('dialog', { name: 'Код подключения устройства' })
    .getByText(/^[A-Z0-9]{6}$/)
    .innerText();
  expect(linkCode).toHaveLength(6);

  const secondaryContext = await browser.newContext();
  const secondary = await secondaryContext.newPage();
  await secondary.goto('/');
  // starts on its own separate default list — doesn't see the primary's item yet
  await expect(secondary.getByRole('checkbox', { name: 'Сыр' })).toHaveCount(0);

  await openListSwitcher(secondary, 'Мои покупки');
  await secondary.getByRole('menuitem', { name: 'Ввести код' }).click();
  await secondary.getByPlaceholder('Код приглашения или устройства').fill(linkCode);
  await secondary.getByRole('button', { name: 'Продолжить' }).click();

  const warningDialog = secondary.getByRole('dialog', { name: 'Подключить устройство?' });
  await expect(warningDialog).toBeVisible();
  await warningDialog.getByRole('button', { name: 'Подключить' }).click();

  // the secondary device's account/lists/items are now the primary's
  await expect(secondary.getByRole('checkbox', { name: 'Сыр' })).toBeVisible();

  await primaryContext.close();
  await secondaryContext.close();
});
```

- [ ] **Step 2: Run and verify**

Run: `pnpm --filter @kupi/e2e test device-link.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/e2e/tests/device-link.spec.ts
git commit -m "test(e2e): cover device linking via link code"
```

---

### Task 11: `offline-sync.spec.ts` — queue while offline, flush on reconnect

**Files:**
- Create: `packages/e2e/tests/offline-sync.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from '@playwright/test';

import { addItem, toggleItem } from './helpers/actions';

test('offline changes apply optimistically and flush to the server once back online', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await addItem(page, 'Йогурт'); // flushes immediately — the device is online

  await context.setOffline(true);
  await toggleItem(page, 'Йогурт');
  // optimistic local patch applies immediately, no network needed
  await expect(page.getByRole('checkbox', { name: 'Йогурт' })).toBeChecked();

  // reusing the cookie in a new context simulates a second device on the same account
  const storageState = await context.storageState();
  const otherContext = await browser.newContext({ storageState });
  const otherPage = await otherContext.newPage();
  await otherPage.goto('/');
  // the toggle is still queued on the offline device, hasn't reached the server yet
  await expect(otherPage.getByRole('checkbox', { name: 'Йогурт' })).not.toBeChecked();

  await context.setOffline(false); // fires the 'online' window event, which triggers a flush

  await expect
    .poll(async () => {
      await otherPage.reload();
      return otherPage.getByRole('checkbox', { name: 'Йогурт' }).isChecked();
    })
    .toBe(true);

  await context.close();
  await otherContext.close();
});
```

- [ ] **Step 2: Run and verify**

Run: `pnpm --filter @kupi/e2e test offline-sync.spec.ts`
Expected: PASS. `expect.poll` retries the reload until the flush lands (or
the assertion's default timeout is hit) — if this is flaky in practice,
increase `expect.poll`'s `timeout` option rather than adding a fixed
`page.waitForTimeout` sleep.

- [ ] **Step 3: Commit**

```bash
git add packages/e2e/tests/offline-sync.spec.ts
git commit -m "test(e2e): cover the offline-sync queue and reconnect flush"
```

---

### Task 12: Wire up `pnpm test:e2e` and gitignore Playwright output

**Files:**
- Modify: `package.json` (root)
- Modify: `.gitignore`

- [ ] **Step 1: Exclude `@kupi/e2e` from the fast `pnpm test`, add `test:e2e`**

Root `package.json` currently has:

```json
    "test": "pnpm -r --if-present test",
```

`pnpm -r --if-present test` would otherwise pick up `@kupi/e2e`'s new
`test` script too, defeating the point of keeping it separate. Change to:

```json
    "test": "pnpm --filter '!@kupi/e2e' -r --if-present test",
    "test:e2e": "pnpm --filter @kupi/e2e test",
```

(insert `test:e2e` right after `test` in the `scripts` object.)

- [ ] **Step 2: Gitignore Playwright's output directories**

Add to `.gitignore` (anywhere — patterns without a leading `/` match at any
depth, so this covers `packages/e2e/test-results/` and
`packages/e2e/playwright-report/` without needing the full path):

```
test-results/
playwright-report/
```

- [ ] **Step 3: Verify**

Run: `pnpm test`
Expected: runs the server and client unit suites only — no Playwright
output in the log.

Run: `pnpm test:e2e`
Expected: runs the full Playwright suite (all 5 spec files from Tasks
7–11), all PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: wire up pnpm test:e2e, keep it out of pnpm test"
```

---

### Task 13: Document the new workspace in `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a `packages/e2e` section**

In `CLAUDE.md`'s `## Commands` section, after the existing `pnpm lint`/lint
sub-bullets and before the "Run a single server test file directly" note,
add:

```markdown
- `pnpm test:e2e` — Playwright e2e suite (`@kupi/e2e`), against real
  server+client instances on dedicated ports 3100/5174 with a throwaway tmp
  SQLite file — separate from `pnpm test` so the fast unit suite stays fast.
  Requires a one-time `pnpm --filter @kupi/e2e exec playwright install
  chromium` to fetch the browser binary.
```

In `CLAUDE.md`'s `## Architecture` section, after the existing three-bullet
list of `shared`/`server`/`client` workspaces, add a fourth bullet:

```markdown
- **`e2e`** — Playwright end-to-end suite (`@kupi/e2e`, private), driving
  the real client against a real server. See `docs/superpowers/specs/2026-07-02-e2e-playwright-design.md`
  for the full design (why dedicated ports, cookie-based test isolation, no
  Page Object Model).
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the @kupi/e2e workspace"
```

---

## Self-review notes

- **Spec coverage:** package/webServer setup (Task 5), the two infra edits +
  a11y fix (Tasks 1–3), all five spec files from the design's "Покрытие
  сценариев" section (Tasks 7–11), the `test`/`test:e2e` script split (Task
  12). Out-of-scope items from the design (cross-browser, CI wiring, visual
  regression, orphaned-device recovery) are intentionally not tasked.
- **Type consistency:** helper signatures in Task 6 (`addItem`, `toggleItem`,
  `openEditor`, `setQuantity`, `pickCategory`, `deleteItem`, `openListMenu`,
  `openListSwitcher`) match their call sites in Tasks 7–11 exactly — every
  spec that opens the list menu or list switcher does so through the
  helper, not an inline `getByRole('button', ...)` duplicate.
