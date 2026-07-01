# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

pnpm workspace monorepo (Node >=22). Install with `pnpm install`.

- `pnpm dev:server` — run `@kupi/server` with `tsx watch` (port 3000, override via `PORT`)
- `pnpm dev:client` — run `@kupi/client` via Vite (dev-proxies `/health`, `/accounts`,
  `/categories`, `/lists`, `/link-codes`, `/link`, `/suggestions` to the server on
  port 3000, so client and server share one origin in dev — no CORS needed)
- `pnpm build` — build the client (`vite build`)
- `pnpm --filter @kupi/client fsd-lint` — `steiger` FSD layer-boundary lint (see below)
- `pnpm test` — run the server test suite (Node's built-in test runner via `tsx`)
- `pnpm lint` — `oxlint .`
- `pnpm format` — `oxfmt .`
- `pnpm typecheck` — `tsc --noEmit` across all packages

Run a single server test file directly (from `packages/server`), tests live next to the module they cover:
`node --import tsx --test src/lists/routes.test.ts`
Filter by test name: add `--test-name-pattern <regex>`.

`packages/server` also has `db:generate-types` (regenerate `src/db/types.ts`
from `db/schema.ts` via `kysely-codegen`, run after editing the DDL) and
`db:verify-types` (same, fails without writing — wired into `pretest`, so
`pnpm test` always catches a forgotten regeneration).

There is no client test suite yet.

## Architecture

Three pnpm workspaces under `packages/`:

- **`shared`** — zod schemas and inferred types shared between server and client (`Account`, `List`, `Item`, `ItemChange`, sync request/response, `Bootstrap`). This is the single source of truth for the wire format; both server routes and (eventually) client code import from `@kupi/shared`.
- **`server`** — Fastify + `better-sqlite3` backend. All feature code.
- **`client`** — React + Vite PWA. First vertical slice implemented: a single active shopping-list screen (add/check/edit/delete items) talking directly to the server's REST API, built as Feature-Sliced Design.

Both `server` and `client` use a `@/*` → `./src/*` tsconfig path alias; `tsx` resolves it directly at runtime, no bundler step needed for the server.

### Server design (`packages/server/src`)

Code is organized by domain, not by technical layer. Each domain folder holds
its own `routes.ts` (Fastify handlers) and `repository.ts` (Kysely queries for
the tables it owns), plus a test file living next to the code it covers:

- **`db/`** — infrastructure, not a domain. `connection.ts` opens the raw
  `better-sqlite3` handle (`openSqlite`) and wraps it in a typesafe Kysely
  query builder (`createDb`, using `SqliteDialect` + `CamelCasePlugin` so
  query-builder code is camelCase while the actual SQLite columns stay
  snake_case). `schema.ts` is the one place that still uses raw SQL:
  idempotent DDL (`CREATE TABLE IF NOT EXISTS`) plus seeding a fixed preset
  category list — kept raw because it's the single source of truth for the
  schema. `types.ts` (the Kysely `DB` interface, one type per table) is
  **generated, not hand-written** — `scripts/generate-db-types.ts` boots an
  in-memory SQLite from `schema.ts`'s `initSchema` and runs `kysely-codegen`
  against it, so the types can never drift from the real DDL. Run
  `pnpm --filter @kupi/server db:generate-types` after editing `schema.ts`;
  `db:verify-types` (wired into `pretest`) fails the build if someone forgot.
  `src/db/types.ts` is excluded from `oxfmt` (see root `.prettierignore`) so
  its checked-in content stays byte-identical to what codegen produces —
  otherwise the formatter would permanently desync it from `--verify`.
  (Codegen also caught a real gap once: SQLite's `TEXT PRIMARY KEY` isn't
  implicitly `NOT NULL` the way Postgres's is, so every single-column text PK
  in `schema.ts` now says `NOT NULL` explicitly.)
- **`shared/`** — cross-domain utilities: `ids.ts` (id/token/code generation,
  name normalization) and `test-helpers.ts` (`makeApp`/`signup`, used by every
  domain's tests).
- **`auth/`** — anonymous accounts, no passwords. `auth.ts` resolves the
  `kupi_dt` device-token cookie to `request.accountId` in an `onRequest` hook
  and does sliding TTL renewal on every authenticated request; `PUBLIC` paths
  (`/health`, `/accounts`, `/link`) skip auth. `repository.ts` owns the
  `devices` table.
- **`accounts/`** — `POST /accounts` creates an account + first device + a
  default list in one transaction and sets the auth cookie. `bootstrap.ts`
  builds the `{ account, lists, categories }` payload returned by both account
  creation and device linking (composes `accounts/repository.ts` and
  `lists/repository.ts`).
- **`link/`** — device linking via a short-lived one-time code
  (`POST /link-codes` → `POST /link`, owns the `link_codes` table).
- **`lists/`** — list CRUD, invites, and membership. `repository.ts` owns
  `lists`, `list_members`, `list_invites`, including access control
  (`isMember`/`isOwner`, checked per-route; non-members get `404` not `403` to
  avoid leaking list existence).
- **`sync/`** — clients push a batch of `ItemChange`s to `POST
/lists/:id/sync` with `lastSeenSeq`, applied atomically in one Kysely
  transaction via `merge.ts`'s `applyChange`. Semantics:
  - Idempotent via `applied_ops(client_op_id)` — replays of the same
    `clientOpId` are no-ops. **Known gap**: this key is a global PK, not
    scoped per-list; safe only because clients generate globally-unique UUIDs
    (see `docs/backend-known-issues.md`).
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
  - `categoryId: null` in a patch is currently indistinguishable from "field
    absent" (both mean "no change") — clearing a category isn't supported
    yet, marked with a `// ponytail:` comment in `merge.ts`.
  - Suggestions (`GET /suggestions`) are backed by `item_frequency`,
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
(`index.ts`) — enforced by `steiger` (`pnpm --filter @kupi/client fsd-lint`,
config in `packages/client/steiger.config.ts`). State is plain `useState`
lifted into `widgets/list-screen/ui/ListScreen.tsx`, no Context/store/TanStack
Query; data access is bare `fetch` via `shared/api/client.ts`'s `get`/`post`.

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
- **`features/`** — `toggle-item` (flip `checked`), `edit-item` (quantity
  stepper, category chips, delete — bundled as one slice since it's one UX
  scene, the "expanded row"), `add-item` (name input with autocomplete
  suggestions from `GET /suggestions`; suggestions are name+count only — the
  backend's `item_frequency` table doesn't store category, so picking one
  just fills the text field, it doesn't set a category or create the item).
- **`widgets/list-screen`** — composes everything above into the actual
  screen: owns `items`/`lastSeenSeq`/`expandedItemId` state, does the initial
  sync fetch on mount (`useEffect` deps deliberately `[list.id]` only, not
  `onSynced` — mount-per-list is intentional, not a missed dependency), and
  toggles each row between `ItemRow` and `features/edit-item`'s `ItemEditor`
  by `expandedItemId`.
- **`pages/list-screen`** + **`app/App.tsx`** — bootstrap flow: `GET /lists` +
  `GET /categories` in parallel; a `401` (brand-new device, no `kupi_dt`
  cookie yet) falls back to `POST /accounts`, which creates the
  account/device/first-list and returns the full `Bootstrap` in one call. The
  bootstrap effect is guarded with a `useRef` flag against React
  `StrictMode`'s dev-mode double-invoke, which would otherwise call
  `POST /accounts` twice on a fresh device and create two accounts.

`steiger.config.ts` disables two rules from `@feature-sliced/steiger-plugin`'s
`recommended` preset: `fsd/insignificant-slice` (every feature/widget here is
used exactly once — expected for a single-screen first slice, not a design
smell) and `fsd/repetitive-naming` (the `*-item` feature names are the
clearest domain vocabulary available, the rule only sees the repeated word).

Design/planning docs live under `docs/superpowers/` (specs and plans); they capture the reasoning behind the current schema and protocol in more depth than inline comments do.
