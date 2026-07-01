# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

pnpm workspace monorepo (Node >=22). Install with `pnpm install`.

- `pnpm dev:server` — run `@kupi/server` with `tsx watch` (port 3000, override via `PORT`)
- `pnpm dev:client` — run `@kupi/client` via Vite
- `pnpm build` — build the client (`vite build`)
- `pnpm test` — run the server test suite (Node's built-in test runner via `tsx`)
- `pnpm lint` — `oxlint .`
- `pnpm format` — `oxfmt .`
- `pnpm typecheck` — `tsc --noEmit` across all packages

Run a single server test file directly (from `packages/server`):
`node --import tsx --test test/lists.test.ts`
Filter by test name: add `--test-name-pattern <regex>`.

There is no client test suite yet.

## Architecture

Three pnpm workspaces under `packages/`:

- **`shared`** — zod schemas and inferred types shared between server and client (`Account`, `List`, `Item`, `ItemChange`, sync request/response, `Bootstrap`). This is the single source of truth for the wire format; both server routes and (eventually) client code import from `@kupi/shared`.
- **`server`** — Fastify + `better-sqlite3` backend. All feature code.
- **`client`** — React + Vite PWA. Currently a bare scaffold (`App.tsx`/`main.tsx`), no real UI yet.

Both `server` and `client` use a `@/*` → `./src/*` tsconfig path alias; `tsx` resolves it directly at runtime, no bundler step needed for the server.

### Server design (`packages/server/src`)

- **Auth model**: anonymous accounts, no passwords. `POST /accounts` creates an account + first device + a default list, and sets an httpOnly device-token cookie (`kupi_dt`, 400-day Max-Age). Every other device links to the same account via a short-lived one-time code (`POST /link-codes` → `POST /link`, see `routes/link.ts`). `auth.ts` resolves the cookie to `request.accountId` in an `onRequest` hook and does sliding TTL renewal on every authenticated request; `PUBLIC` paths (`/health`, `/accounts`, `/link`) skip auth.
- **Access control** (`access.ts`): list membership (`isMember`) and ownership (`isOwner`) are checked per-route; non-members get `404` (not `403`) to avoid leaking list existence.
- **Sync protocol** (`routes/sync.ts`, `merge.ts`): clients push a batch of `ItemChange`s to `POST /lists/:id/sync` with `lastSeenSeq`, applied atomically in one transaction via `applyChange`. Semantics:
  - Idempotent via `applied_ops(client_op_id)` — replays of the same `clientOpId` are no-ops. **Known gap**: this key is a global PK, not scoped per-list; safe only because clients generate globally-unique UUIDs (see `docs/backend-known-issues.md`).
  - Remove-wins: a tombstoned item (`deleted=1`) is never resurrected by a non-delete change.
  - Column-wise LWW patch via `COALESCE`: an upsert only overwrites fields present in the payload, so concurrent edits to different fields on the same item both survive; concurrent edits to the same field, last-to-arrive wins.
  - Every list has a monotonic `seq`, bumped per applied change; items carry a `version` = the `seq` at last write. The response is a delta pull: all items with `version > lastSeenSeq`, tombstones included.
  - `categoryId: null` in a patch is currently indistinguishable from "field absent" (both mean "no change") — clearing a category isn't supported yet, marked with a `// ponytail:` comment in `merge.ts`.
- **`bootstrap.ts`**: builds the `{ account, lists, categories }` payload returned by both account creation and device linking.
- **`schema.ts`**: idempotent DDL (`CREATE TABLE IF NOT EXISTS`) run on every app boot, plus seeding of a fixed preset category list with stable ids (custom categories are not implemented).
- **`map.ts`**: row → shared-type mappers (snake_case SQLite columns → camelCase API shapes).
- Suggestions (`GET /suggestions`) are backed by `item_frequency`, incremented only when a *new* named item is created (not on edits), keyed by `(account_id, normalized_name)`.

See `docs/backend-known-issues.md` for the current list of deliberately-deferred backend issues (idempotency key scope, cookie renewal on rejected requests, category-clear sentinel, purge sweeps, token rotation, etc.) — check it before "fixing" something that looks like a bug but was a scoped MVP tradeoff.

Design/planning docs live under `docs/superpowers/` (specs and plans); they capture the reasoning behind the current schema and protocol in more depth than inline comments do.
