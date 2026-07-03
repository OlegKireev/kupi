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
  domain's tests).
- **`auth/`** — anonymous accounts, no passwords. `auth.ts` resolves the
  `kupi_dt` device-token cookie to `request.accountId` in an `onRequest` hook
  and does sliding TTL renewal on every authenticated request; `PUBLIC` paths
  (`/api/health`, `/api/accounts`, `/api/link`) skip auth. `repository.ts` owns the
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
  avoid leaking list existence).
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

See `docs/backend-known-issues.md` for the current list of deliberately-deferred backend issues (idempotency key scope, cookie renewal on rejected requests, category-clear sentinel, purge sweeps, token rotation, etc.) — check it before "fixing" something that looks like a bug but was a scoped MVP tradeoff.

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
- **`features/list-switcher`** — the list title + `CaretDown` in the header;
  tapping it opens a Mantine `Menu` listing the user's `lists` (switch is a
  synchronous prop callback, no refetch) plus "Новый список", which opens a
  small `Modal` with a `TextInput` calling `createList`, and "Ввести код",
  the receiving side of both `list-menu` share flows. `model/useListSwitcher.ts`
  (by analogy with `list-menu/model/useListMenu.ts`) owns all three modals'
  state; `model/code-kind.ts` classifies the typed code by length — 8 chars
  is a list invite (`joinList` → `POST /api/lists/join`), 6 is a device link
  code (`redeemLinkCode` → `POST /api/link`), anything else is rejected
  client-side with no network call. Redeeming a device link code shows a
  warning modal first (it replaces this device's account cookie — any lists
  it currently has become unreachable from it, recovery isn't implemented)
  and, on confirm, calls the new `onAccountLinked(bootstrap)` prop — piped
  down from `app/App.tsx` the same way `onSwitchList`/`onListsChanged` are —
  which replaces `lists`/`categories`/`activeListId` wholesale from the
  `Bootstrap` the server already returns from `POST /api/link`, no second
  round-trip.
  `400 invalid_code` from either endpoint, and a client-side-rejected code,
  surface as an `@mantine/notifications` toast (new dependency — the first
  reusable error-toast pattern in the app, mounted once in `main.tsx`). It
  doesn't own the list of lists — `lists`/`activeListId` and the
  switch/refresh callbacks are all passed down from `app/App.tsx`.
- **`features/list-menu`** — the "⋮" `ActionIcon`, one Mantine `Menu` bundling
  the whole "list settings" scene (same one-slice-per-UX-scene pattern as
  `edit-item`): "Пригласить" (`POST /api/lists/:id/invites`) and "Подключить
  устройство" (`POST /api/link-codes`, its own `api/link-code-api.ts` since
  device-linking isn't list domain — same reasoning as `add-item`'s
  `suggestions-api.ts`) both open the same code-`Modal` shape with a
  "Копировать" button (`navigator.clipboard.writeText`); "Участники (N)" is a
  disabled label that lazy-loads `getMemberCount` on menu open; "Переименовать
  список" opens a `Modal` pre-filled with the current name; "Удалить/покинуть
  список" is a single confirm-`Modal` and a single `deleteList` call
  regardless of role — `DELETE /api/lists/:id`'s owner-deletes-vs-member-leaves
  branching happens entirely server-side, the client never checks who owns
  the list. The dropdown's first entry is a non-interactive `Menu.Label` showing sync
  status — derived from `entities/item`'s `pendingCount`/`failedCount` (piped
  down from `ListScreen`) and `shared/lib/useOnlineStatus.ts` by
  `model/sync-status.ts`'s `getSyncStatusText` — the sync-status line
  deferred in `2026-07-01-list-header-menu-design.md`.
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
  manual state patching, this isn't a hot path. If a delete/leave empties
  `lists`, `refreshLists` creates a fallback "Мои покупки" list, the same
  pattern used for a brand-new account's first list. A network error (not `ApiError`) during the initial `GET /lists`+`GET
/categories` falls back to a `localStorage` cache (`kupi:bootstrap`,
  written by `app/model/bootstrap-cache.ts` on every `lists`/`categories`
  change) — covers reopening the app offline. No cache yet (device's very
  first launch, offline) — unchanged empty-screen behavior, a known gap, not
  a regression.

Icons throughout the header/menu are `@phosphor-icons/react` components
(`CaretDown`, `DotsThreeVertical`, `Copy`, `Trash`), not the text glyphs
(`▾`/`⋮`) the original UI design spec assumed — a decision made once the
header was actually implemented, see
`docs/superpowers/specs/2026-07-01-list-header-menu-design.md`. That spec also
documented the sync-status line as deferred pending a client-side
offline-change queue — now implemented (see `features/list-menu` above,
`docs/superpowers/specs/2026-07-02-offline-sync-queue-design.md`). The
other deferred piece — redeeming an invite/link code — is now built (see
`features/list-switcher` above, `docs/superpowers/specs/2026-07-02-redeem-code-design.md`).
Deep links (`?code=...` auto-opening the modal) and QR codes for device
linking are still out of scope — codes are copy-pasted by hand today — as is
recovery for a device that gets orphaned by redeeming a link code onto a
different account (`docs/backend-known-issues.md`). See
`docs/client-known-issues.md` for review findings from that feature (an
`onAccountLinked` edge case) not worth fixing inline, and for the
now-fixed stale-service-worker gotcha that used to produce misleading
symptoms during manual
browser QA in this dev environment.

`steiger.config.ts` disables two rules from `@feature-sliced/steiger-plugin`'s
`recommended` preset: `fsd/insignificant-slice` (every feature/widget here is
used exactly once — expected for a single-screen first slice, not a design
smell) and `fsd/repetitive-naming` (the `*-item` feature names are the
clearest domain vocabulary available, the rule only sees the repeated word).

Design/planning docs live under `docs/superpowers/` (specs and plans); they capture the reasoning behind the current schema and protocol in more depth than inline comments do.
