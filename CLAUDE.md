# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

pnpm workspace monorepo (Node >=22). Install with `pnpm install`.

- `pnpm dev` — run both `dev:server` and `dev:client` together via `concurrently`
- `pnpm dev:server` — run `@kupi/server` with `tsx watch` (port 3000, override via `PORT`)
- `pnpm dev:client` — run `@kupi/client` via Vite (dev-proxies `/api` to the server on
  port 3000, so client and server share one origin in dev — no CORS needed)
- `pnpm build` — build the client (`vite build`)
- `pnpm test` — run every package's test suite (`pnpm -r --if-present test`):
  the server suite (Node's built-in test runner via `tsx`) and the client
  suite (`vitest run`, `packages/client`, jsdom environment)
- `pnpm lint` — all three lints in parallel via `concurrently`
- `pnpm lint:js` / `lint:types` / `lint:arch` — `oxlint` / `tsc --noEmit` / `steiger`
  FSD layer-boundary lint (client only, see below). Each package defines its own
  `lint:*` scripts; the root just fans out via `pnpm -r`, so one package can be
  checked with e.g. `pnpm --filter @kupi/client lint:types`
- `pnpm format` — `oxfmt .`
- `pnpm test:e2e` — Playwright e2e suite (`@kupi/e2e`), against real
  server+client instances on dedicated ports 3100/5174 with a throwaway tmp
  SQLite file — separate from `pnpm test` so the fast unit suite stays fast.
  Requires a one-time `pnpm --filter @kupi/e2e exec playwright install
chromium` to fetch the browser binary.

Run a single server test file directly (from `packages/server`), tests live next to the module they cover:
`node --import tsx --test src/lists/routes.test.ts`
Filter by test name: add `--test-name-pattern <regex>`.

`packages/server` also has `db:generate-types` (regenerate `src/db/types.ts`
from `db/migrations/` via `kysely-codegen`, run after adding a migration) and
`db:verify-types` (same, fails without writing — wired into `pretest`, so
`pnpm test` always catches a forgotten regeneration).

`packages/client`'s vitest suite covers pure logic only (offline-queue
retry policy, optimistic local patch, localStorage cache, sync-status text)
— hooks and UI aren't covered, there's no React Testing Library in the
project yet.

## Architecture

Three pnpm workspaces under `packages/`:

- **`shared`** — zod schemas and inferred types shared between server and client (`Account`, `List`, `Item`, `ItemChange`, sync request/response, `Bootstrap`). This is the single source of truth for the wire format; both server routes and (eventually) client code import from `@kupi/shared`.
- **`server`** — Fastify + `better-sqlite3` backend. All feature code.
- **`client`** — React + Vite PWA. First vertical slice implemented: a single active shopping-list screen (add/check/edit/delete items) talking directly to the server's REST API, built as Feature-Sliced Design.
- **`e2e`** — Playwright end-to-end suite (`@kupi/e2e`, private), driving
  the real client against a real server. See `docs/superpowers/specs/2026-07-02-e2e-playwright-design.md`
  for the full design (why dedicated ports, cookie-based test isolation, no
  Page Object Model).

Both `server` and `client` use a `@/*` → `./src/*` tsconfig path alias; `tsx` resolves it directly at runtime, no bundler step needed for the server.

### Server design (`packages/server/src`)

Code is organized by domain, not by technical layer. Each domain folder holds
its own `routes.ts` (Fastify handlers) and `repository.ts` (Kysely queries for
the tables it owns), plus a test file living next to the code it covers:

- **`db/`** — infrastructure, not a domain. `connection.ts` opens the raw
  `better-sqlite3` handle (`openSqlite`) and wraps it in a typesafe Kysely
  query builder (`createDb`, using `SqliteDialect` + `CamelCasePlugin` so
  query-builder code is camelCase while the actual SQLite columns stay
  snake_case). Schema is versioned via a real Kysely `Migrator`
  (`migrator.ts`): `db/migrations/` holds one file per migration
  (`001-init.ts`, ..., each exporting `up`/optional `down`, raw SQL via
  Kysely's `sql` tag — one statement per `sql.raw(...).execute(db)` call,
  since better-sqlite3 rejects multi-statement strings through Kysely's
  driver), registered in `db/migrations/index.ts`'s `migrations` record.
  `migrateToLatest(db)` runs whatever hasn't been applied yet, tracked in
  the `kysely_migration` table — this replaced a plain `CREATE TABLE IF NOT
EXISTS` DDL blob that could only ever create tables, never alter existing
  ones, which is what caused a real incident: a column added to
  `applied_ops`/`items` in `schema.ts` never reached already-existing dev
  `kupi.db` files, so `sync` returned `SQLITE_ERROR: table applied_ops has
no column named list_id` until the stale file was deleted by hand.
  Migration `001-init` still uses `CREATE TABLE IF NOT EXISTS` (not plain
  `CREATE TABLE`) — every pre-migrator dev DB already has these tables from
  the old `schema.ts` DDL but no `kysely_migration` bookkeeping, so the
  first real run must be a no-op adopting the existing schema, not a
  collision. Future migrations don't need that guard, only 001 does (its
  job is exactly to adopt pre-migrator databases). `buildApp` (`app.ts`) is
  now `async` — it builds the Kysely `db`, awaits `migrateToLatest(db)`,
  then calls `schema.ts`'s `seedCategories(sqlite)` — every caller
  (`index.ts`, `shared/test-helpers.ts`'s `makeApp`, and every test that
  used to call `buildApp`/`makeApp` synchronously) awaits it now.
  `schema.ts` itself now only holds the preset category list and
  `seedCategories` — categories are seed data, not schema, so they stay
  outside the migrator (idempotent `INSERT OR IGNORE`, run on every
  startup regardless of migration state). `types.ts` (the Kysely `DB`
  interface, one type per table) is **generated, not hand-written** —
  `scripts/generate-db-types.ts` boots an in-memory SQLite, runs
  `migrateToLatest`, and feeds that to `kysely-codegen`, so the types can
  never drift from what the migrations actually create. Run
  `pnpm --filter @kupi/server db:generate-types` after adding a migration;
  `db:verify-types` (wired into `pretest`) fails the build if someone
  forgot. `src/db/types.ts` is excluded from `oxfmt` (see root
  `.prettierignore`) so its checked-in content stays byte-identical to what
  codegen produces — otherwise the formatter would permanently desync it
  from `--verify`. (Codegen also caught a real gap once: SQLite's `TEXT
PRIMARY KEY` isn't implicitly `NOT NULL` the way Postgres's is, so every
  single-column text PK in `db/migrations/001-init.ts` says `NOT NULL`
  explicitly.)
- **`shared/`** — cross-domain utilities: `ids.ts` (id/token/code generation,
  name normalization) and `test-helpers.ts` (`makeApp`/`signup`, used by every
  domain's tests). `makeApp`'s in-memory `Database` explicitly runs
  `pragma('foreign_keys = ON')` — the same as `db/connection.ts`'s
  `openSqlite` used by the real server — so a broken FK reference (e.g. a
  domain forgetting to delete a child row before its parent) fails a unit
  test instead of only surfacing against the real server/e2e. This caught a
  real bug: `lists/repository.ts`'s `deleteList` never cleared `applied_ops`
  before deleting the `lists` row, so deleting a list that had ever been
  synced through `POST /sync` threw `SQLITE_CONSTRAINT_FOREIGNKEY` — invisible
  under the old FK-less test DB, visible (intermittently, depending on
  `findListsForAccount`'s `createdAt` sort tie-break) in e2e.
- **`auth/`** — anonymous accounts, no passwords. `auth.ts` resolves the
  `kupi_dt` device-token cookie to `request.accountId` in an `onRequest` hook;
  `PUBLIC` paths (`/api/health`, `/api/accounts`, `/api/link`) skip auth. A
  separate `onSend` hook does sliding TTL renewal, but only when
  `req.accountId` is set and the response is 2xx — so a request the handler
  itself rejects (e.g. `404` on a list the caller isn't a member of) doesn't
  extend the cookie's lifetime. `repository.ts` owns the
  `devices` table.
- **`accounts/`** — `POST /api/accounts` creates an account + first device + a
  default list in one transaction and sets the auth cookie. `bootstrap.ts`
  builds the `{ account, lists, categories }` payload returned by both account
  creation and device linking (composes `accounts/repository.ts` and
  `lists/repository.ts`).
- **`link/`** — device linking via a short-lived one-time code
  (`POST /api/link-codes` → `POST /api/link`, owns the `link_codes` table).
- **`lists/`** — list CRUD, invites, and membership. `repository.ts` owns
  `lists`, `list_members`, `list_invites`, including access control
  (`isMember`/`isOwner`, checked per-route; non-members get `404` not `403` to
  avoid leaking list existence). The `List` wire type (`@kupi/shared`) carries
  a `role: 'owner' | 'member'` field — the caller's own role in that list, not
  an intrinsic property of the list — so it only exists on responses computed
  relative to `req.accountId`. `findListsForAccount` (backs `GET /api/lists`
  and `buildBootstrap`) joins `list_members.role` directly; `findListById`
  (a plain by-id lookup with no account context) deliberately returns
  `Omit<List, 'role'>`, and its three callers (create/rename/join) attach
  `role` themselves since each already knows it locally. `PATCH /lists/:id`
  (rename) is owner-only too (`isOwner`, not `isMember` — a plain member
  can no longer rename); `DELETE /lists/:id` stays open to any member, since
  it's the one route where non-owner access is the point (owner deletes the
  list outright, a member just leaves it — same endpoint, branching only in
  which repository call runs). On the client, `features/list-switcher` uses
  `list.role === 'owner'` to hide "Пригласить в список" and "Переименовать
  список" for non-owners — the routes themselves already 404 non-owners, this
  just avoids a dead-end click for a member who can't tell from the UI that
  they aren't the owner. The delete/leave item and its confirm modal instead
  stay visible for everyone but relabel by role ("Удалить список" /
  "Покинуть список"), matching the two real outcomes of that one endpoint.
- **`sync/`** — clients push a batch of `ItemChange`s to `POST
/api/lists/:id/sync` with `lastSeenSeq`, applied atomically in one Kysely
  transaction via `merge.ts`'s `applyChange`. Semantics:
  - Idempotent via `applied_ops(list_id, client_op_id)` — replays of the same
    `clientOpId` within a list are no-ops; the same `clientOpId` reused on a
    different list is not deduped against it.
  - `items` is keyed by `PRIMARY KEY (list_id, id)`, not `id` alone — a
    colliding `itemId` on two different lists is two independent rows, not a
    cross-list clobber. `findItemById`/`patchItem`/`tombstoneItem` all take
    `listId` for this reason.
  - Remove-wins: a tombstoned item (`deleted=1`) is never resurrected by a
    non-delete change.
  - Column-wise LWW patch: an upsert builds a Kysely update object containing
    only the fields present in the payload (instead of a `COALESCE` string),
    so concurrent edits to different fields on the same item both survive;
    concurrent edits to the same field, last-to-arrive wins.
  - Every list has a monotonic `seq` (`lists/repository.ts`'s
    `incrementListSeq`, via `UPDATE ... RETURNING`), bumped per applied
    change; items carry a `version` = the `seq` at last write. The response
    is a delta pull: all items with `version > lastSeenSeq`, tombstones
    included.
  - Clearing a category: a patch distinguishes `categoryId` absent (`undefined`
    — no change) from explicit `null` (clears the category) for an _existing_
    item; for a brand-new item `null` means "not specified" and falls through
    to the carry-over-by-name lookup below instead. `ItemEditor`'s category
    chip group has a "Без категории" option wired to `categoryId: null`.
  - Category carries over on re-add: when inserting a brand-new item (new
    `itemId`, e.g. add-item always mints one) with no explicit `categoryId`,
    `merge.ts` looks up the most recent `categoryId` for a case-insensitive
    name match in the same list (`sync/repository.ts`'s
    `findLastCategoryIdForName`, matches tombstoned items too) — so deleting
    an item and re-adding it by name doesn't lose its category.
  - Suggestions (`GET /api/suggestions`) are backed by `item_frequency`,
    incremented only when a _new_ named item is created (not on edits), keyed
    by `(account_id, normalized_name)`.

The only remaining row → shared-type mapping is `Item` (`sync/repository.ts`'s
private `rowToItem`, coercing SQLite's `0`/`1` to `boolean`) — every other
domain's Kysely `Selectable<Table>` result already matches its `@kupi/shared`
zod type once `CamelCasePlugin` handles the casing.

`db/purge.ts`'s `purgeStaleData(db, now?)` sweeps the two tables that grow
monotonically with every sync operation: rows in `applied_ops` (idempotency
keys) and tombstoned `items` (`deleted=1`) older than `RETENTION_MS` (30
days) are deleted. Migration `002-applied-ops-created-at` added
`applied_ops.created_at` for this (existing rows default to `0`, so they're
treated as stale and purged on the first sweep — harmless, since an
idempotency key only needs to survive a short offline-retry window).
`item_frequency` is deliberately not swept — it's keyed by distinct item
name per account, not by operation, so it doesn't grow unbounded the way the
other two do. `buildApp` runs one sweep at startup (next to `seedCategories`,
same idempotent-on-every-start pattern); `index.ts` additionally reschedules
it every 24h via `setInterval(...).unref()` for the long-running process
(tests build a fresh app per case via `makeApp`, so they only ever get the
one startup sweep, never the interval).

See `docs/backend-known-issues.md` for the current list of deliberately-deferred backend issues (idempotency key scope, cookie renewal on rejected requests, category-clear sentinel, token rotation, etc.) — check it before "fixing" something that looks like a bug but was a scoped MVP tradeoff.

### Client design (`packages/client/src`)

Feature-Sliced Design, all 6 layers (`app → pages → widgets → features →
entities → shared`), import only "downward" through a slice's public API
(`index.ts`) — enforced by `steiger` (`pnpm --filter @kupi/client lint:arch`,
config in `packages/client/steiger.config.ts`). State is plain `useState`,
no Context/store/TanStack Query — `lists`/`activeListId`/`categories` live in
`app/App.tsx`, per-list `items`/`lastSeenSeq`/`expandedItemId` live in
`widgets/list-screen/ui/ListScreen.tsx`; data access is bare `fetch` via
`shared/api/client.ts`'s `get`/`post`/`patch`/`del`.

- **`shared/`** — `api/client.ts` (thin `fetch` wrapper + `ApiError`),
  `config/env.ts` (`API_BASE_URL`, currently `''` — relative paths + the Vite
  dev-proxy keep client and server on one origin; revisit once they're
  deployed separately), `lib/ids.ts` (`generateId`, wraps
  `crypto.randomUUID()`). `api/` and `config/` each have a public-API
  `index.ts` — required by `steiger`'s `fsd/public-api` rule, so every other
  slice imports `@/shared/api`/`@/shared/config`, never the deep path.
- **`entities/`** — `list` (`getLists`/`createAccount`), `category`
  (`getCategories` + `CategoryIcon`), `item` (`syncItems`, `mergeItems`
  merges a sync delta into the local item list by id, filtering tombstones;
  `ItemRow`, a read-only row). `ItemRow` deliberately does **not** import
  `entities/category`'s `CategoryIcon` directly — that would be a same-layer
  cross-entity import, which `steiger`'s `fsd/no-cross-imports` forbids.
  Instead it takes a `categoryIcon: ReactNode` prop slot, filled in by
  `widgets/list-screen` (which sits above both entities).

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

- **`features/`** — `toggle-item` (flip `checked`), `edit-item` (quantity
  stepper, category chips, delete — bundled as one slice since it's one UX
  scene, the "expanded row"), `add-item` (name input with autocomplete
  suggestions from `GET /api/suggestions`; suggestions are name+count only — the
  backend's `item_frequency` table doesn't store category, so picking one
  just fills the text field, it doesn't set a category or create the item).
- **`widgets/list-screen`** — composes everything above into the actual
  screen: owns only `expandedItemId` state now, `items` and sync state come
  from `entities/item`'s `useItemSync(list.id)` — mount-per-list (`[list.id]`
  as the hook's own dependency) is still intentional, not a missed
  dependency. Toggles each row between `ItemRow` and `features/edit-item`'s
  `ItemEditor` by `expandedItemId`. `toggle-item`/`add-item`/`edit-item`
  build an `ItemChange` and call `useItemSync`'s `applyChange` directly —
  none of them know about `syncItems`/the network anymore.
- **`features/list-switcher`** — the list title + `CaretDown` in the header,
  the single entry point for everything list-domain (redesigned per
  `docs/superpowers/specs/2026-07-03-list-header-menu-redesign-design.md`,
  which split the former ambiguous "⋮" menu into a list-scoped menu here and
  an account-scoped menu in `features/account-menu`). Tapping the title opens
  one Mantine `Menu`, top to bottom: a non-interactive `Menu.Label` sync-status
  line (`model/sync-status.ts`'s `getSyncStatusText`, driven by
  `entities/item`'s `pendingCount`/`failedCount` piped down from `ListScreen`
  and `shared/lib/useOnlineStatus.ts`); "Пригласить в список"
  (`POST /api/lists/:id/invites`, code-`Modal` with a "Копировать" button);
  "Участники (N)", a disabled label lazy-loading `getMemberCount` on menu
  open; "Переименовать список", a `Modal` pre-filled with the current name;
  "Удалить/покинуть список", a single confirm-`Modal` and single `deleteList`
  call regardless of role (`DELETE /api/lists/:id`'s
  owner-deletes-vs-member-leaves branching is entirely server-side, the
  client never checks who owns the list); a divider; the user's other `lists`
  (switch is a synchronous prop callback, no refetch), the active one marked
  with a `CheckIcon` in `rightSection` instead of background highlighting (to
  avoid clashing with Mantine `Menu.Item`'s hover style); a divider; "Новый
  список" (`Modal` + `TextInput` → `createList`); "Присоединиться по коду
  списка" (`Modal` + `TextInput`, list-invite codes only — 8 chars, no more
  length-based guessing) → `joinList`. `model/useListSwitcher.ts` owns all of
  this state (absorbed from the deleted `list-menu/model/useListMenu.ts`);
  `model/code-kind.ts` is deleted along with it — device link codes are
  entered exclusively through `account-menu` now, so there's no code input
  left that needs to guess its type by length. `400 invalid_code` surfaces as
  an `@mantine/notifications` toast (`notifications`, mounted once in
  `main.tsx`). It doesn't own the list of lists — `lists`/`activeListId` and
  the switch/refresh callbacks are all passed down from `app/App.tsx`.
- **`features/account-menu`** — a `UserCircleIcon` `ActionIcon` next to
  `list-switcher` in the header (replaces the old `list-menu`'s
  `DotsThreeVerticalIcon`, now dropped from `shared/ui`'s re-export), the
  device/account counterpart split out of the same redesign. Menu: "Подключить
  это устройство" → `createLinkCode` (`api/link-code-api.ts`, moved here from
  the deleted `list-menu`), code-`Modal` with "Копировать" — same shape as
  list-switcher's invite modal, just a different code; "Ввести код устройства"
  → `Modal` + `TextInput` (device codes only — 6 chars) → a warning
  confirm-`Modal` ("заменит аккаунт этого устройства... текущие списки станут
  недоступны", recovery isn't implemented) → on confirm, `redeemLinkCode` then
  `onAccountLinked(bootstrap)`. `model/useAccountMenu.ts` owns this state
  (device-link half ported unchanged from the old
  `useListSwitcher`/`useListMenu`).
  `onAccountLinked(bootstrap: Bootstrap) => Promise<void>` — piped down from
  `app/App.tsx` the same way `onSwitchList`/`onListsChanged` are — replaces
  `lists`/`categories`/`activeListId` wholesale from the `Bootstrap` the
  server already returns from `POST /api/link`, no second round-trip.
- **`pages/list-screen`** + **`app/App.tsx`** — bootstrap flow: `GET /api/lists` +
  `GET /api/categories` in parallel; a `401` (brand-new device, no `kupi_dt`
  cookie yet) falls back to `POST /api/accounts`, which creates the
  account/device/first-list and returns the full `Bootstrap` in one call. The
  bootstrap effect is guarded with a `useRef` flag against React
  `StrictMode`'s dev-mode double-invoke, which would otherwise call
  `POST /api/accounts` twice on a fresh device and create two accounts.
  `lists`/`activeListId` (not a single `list`) live here so the header can
  switch between lists; any list mutation (create/rename/delete-leave) calls
  a shared `refreshLists(selectId?)` that just refetches `GET /api/lists` — no
  manual state patching, this isn't a hot path. Both `refreshLists` and
  `onAccountLinked` (see `features/account-menu` above) go through one
  `applyLists(fetchedLists, selectId?)` helper that sets `lists`/`activeListId`
  and creates a fallback "Мои покупки" list whenever the list would otherwise
  be empty — the same pattern for a delete/leave that empties `lists`, a
  freshly linked account with 0 lists, or a brand-new account's first list.
  `onAccountLinked` is `async` (awaits `applyLists`, which may await
  `createList`) — its prop type is `(bootstrap: Bootstrap) => Promise<void>`
  through every layer (`ListScreenPage`, `ListScreen`, `useAccountMenu`,
  `AccountMenu`), and `useAccountMenu`'s `confirmLinkDevice` awaits it. A network error (not `ApiError`) during the initial `GET /lists`+`GET
/categories` falls back to a `localStorage` cache (`kupi:bootstrap`,
  written by `app/model/bootstrap-cache.ts` on every `lists`/`categories`
  change) — covers reopening the app offline. No cache yet (device's very
  first launch, offline) — unchanged empty-screen behavior, a known gap, not
  a regression.

Icons throughout the header/menu are `@phosphor-icons/react` components
(`CaretDown`, `UserCircle`, `Copy`, `Trash`), not the text glyphs
(`▾`/`⋮`) the original UI design spec assumed — a decision made once the
header was actually implemented, see
`docs/superpowers/specs/2026-07-01-list-header-menu-design.md`. That spec also
documented the sync-status line as deferred pending a client-side
offline-change queue — now implemented (see `features/list-switcher` above,
`docs/superpowers/specs/2026-07-02-offline-sync-queue-design.md`). The
other deferred piece — redeeming an invite/link code — is now built (see
`features/account-menu` above, `docs/superpowers/specs/2026-07-02-redeem-code-design.md`).
The original combined "⋮" `list-menu` slice from that work was later split
into `list-switcher` (list-domain actions) and `account-menu` (device/account
actions) — see `docs/superpowers/specs/2026-07-03-list-header-menu-redesign-design.md`.
Deep links and QR codes for both invite/link codes are now built (see
`docs/superpowers/specs/2026-07-03-qr-deeplink-sharing-design.md`):
`shared/lib/deep-link.ts` (no `index.ts` barrel needed for `shared/lib/`,
imported by its file path) exports `parseDeepLink`/`buildDeepLink`, reading/
writing `?listCode=`/`?deviceCode=` query params from `window.location.origin`
(no `API_BASE_URL`/production-domain config exists yet, see
`shared/config/env.ts`). `App.tsx` parses `window.location.search` once on
boot (same `useRef`-guard pattern as the bootstrap effect), stashes the result
in `deepLink` state, and resets the URL via `window.history.replaceState`
(the app has no other query params today, so this clears the whole query
string rather than surgically removing one key). `deepLink` is threaded down
as `initialListCode`/`initialDeviceCode` + `onDeepLinkConsumed` through
`ListScreenPage`/`ListScreen` to `ListSwitcher`/`AccountMenu` — each hook
(`useListSwitcher`/`useAccountMenu`) has its own `useRef`-guarded effect that,
on a non-empty `initialCode`, pre-fills and opens the same modal manual entry
would have opened, then calls `onDeepLinkConsumed()`. `shared/ui/CodeShareModal.tsx`
(new dependency: `qrcode` + `@types/qrcode`, dev) is the first real
composition in `shared/ui` (previously only Mantine/icon re-exports) — it
replaces the two near-identical inline code-modals in `ListSwitcher`/
`AccountMenu` with one component: QR image (`QRCode.toDataURL`) on top, the
bare code as text below, "Копировать" (copies the full deep-link `url`, not
the bare code — a deliberate change so the recipient can just tap the link),
and "Поделиться" (`navigator.share`, rendered only when
`typeof navigator.share === 'function'`). Recovery for a device that gets
orphaned by redeeming a link code onto a different account is still not
implemented (`docs/backend-known-issues.md`). See `docs/client-known-issues.md`
for review findings from the header-menu-redesign feature (an
`onAccountLinked` edge case) not worth fixing inline, and for the
now-fixed stale-service-worker gotcha that used to produce misleading
symptoms during manual browser QA in this dev environment.

`steiger.config.ts` disables two rules from `@feature-sliced/steiger-plugin`'s
`recommended` preset: `fsd/insignificant-slice` (every feature/widget here is
used exactly once — expected for a single-screen first slice, not a design
smell) and `fsd/repetitive-naming` (the `*-item` feature names are the
clearest domain vocabulary available, the rule only sees the repeated word).

Design/planning docs live under `docs/superpowers/` (specs and plans); they capture the reasoning behind the current schema and protocol in more depth than inline comments do.

## Verification

Before considering any change done, run `pnpm test:e2e` as the final check —
after `pnpm test`/`pnpm lint` pass, not instead of them. Unit tests don't
catch UI-copy/selector drift (e.g. a Mantine menu-item label changing text
breaks a Playwright locator, not a unit test) or cross-device sync
behavior; e2e is the only suite exercising the real client against a real
server end to end. Applies to every change that touches client or server
code, not just ones that look UI-related.

## Git workflow

Don't use worktree branches, work directly on `master` branch without feature branches. Use subagents if it's possible, or if you need to work on multiple features at once.
