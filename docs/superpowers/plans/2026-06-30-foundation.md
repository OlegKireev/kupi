# Foundation (Monorepo Skeleton) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm monorepo so `pnpm install` works, the Fastify server boots with a `/health` endpoint backed by SQLite, the React PWA client builds, and the `shared` package is consumed by both sides.

**Architecture:** pnpm workspace with three packages — `shared` (TS types, no build, consumed via source), `server` (Fastify + better-sqlite3, run/test via `tsx`), `client` (Vite + React + vite-plugin-pwa). Root holds shared dev tooling (TypeScript, oxlint, oxfmt) and base tsconfig. This plan delivers only the skeleton; domain schema and features come in the backend/client plans.

**Tech Stack:** pnpm workspace, TypeScript, Fastify v5, better-sqlite3, tsx (TS runner), node:test, Vite, React, vite-plugin-pwa, oxlint, oxfmt.

> **Versions:** spec says install at `latest`. Steps use `pnpm add` so the resolved version is written to `package.json` automatically — do not hand-pin versions.
> **ponytail note:** if `oxfmt` is not yet published as a standalone CLI at install time, fall back to `prettier` for the `fmt` script. Everything else is unaffected.
> **Implementation reality (filled in during execution):** versions resolved to TypeScript 6.0.3, oxlint 1.72.0, oxfmt 0.57.0 (published, no prettier fallback needed); Node 24, pnpm 10. `git init` created branch `master` (system git default), not `main` — all commits land on `master`. A few config tweaks below were required to make the literal code actually run; they are marked **[execution fix]**.

---

### Task 0: Initialize git and ignore files

**Files:**
- Create: `.gitignore`
- Create: `.npmrc`

- [ ] **Step 1: Init the repo**

The project dir is not yet a git repository. Run:

```bash
git init
```

Expected: `Initialized empty Git repository in .../kupi/.git/`

- [ ] **Step 2: Write `.gitignore`**

```gitignore
node_modules/
dist/
*.tsbuildinfo
# SQLite data files
*.db
*.db-shm
*.db-wal
.DS_Store
```

- [ ] **Step 3: Write `.npmrc`**

Hoist nothing unexpected; keep workspace deps strict.

```
engine-strict=true
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore .npmrc
git commit -m "chore: init git repo with ignore files"
```

---

### Task 1: Root workspace config and shared tooling

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.oxlintrc.json`

- [ ] **Step 1: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 2: Write root `package.json`**

Scripts delegate to packages via pnpm `--filter`. `test` runs only the server (client has no tests at start per spec).

```json
{
  "name": "kupi",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev:server": "pnpm --filter @kupi/server dev",
    "dev:client": "pnpm --filter @kupi/client dev",
    "build": "pnpm --filter @kupi/client build",
    "test": "pnpm --filter @kupi/server test",
    "lint": "oxlint .",
    "fmt": "oxfmt .",
    "typecheck": "pnpm -r exec tsc --noEmit"
  }
}
```

- [ ] **Step 3: Install root dev tooling**

```bash
pnpm add -w -D typescript tsx oxlint oxfmt
```

Expected: `typescript`, `tsx`, `oxlint`, `oxfmt` appear under `devDependencies` in root `package.json` with resolved versions.

- [ ] **Step 4: Write `tsconfig.base.json`**

Strict, modern, ESM. Packages extend this.

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "declaration": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

> **[execution fix]** `allowImportingTsExtensions: true` is required because the code imports modules with explicit `.ts` extensions (needed by tsx / Node ESM); without it `tsc --noEmit` errors across every package.

- [ ] **Step 5: Write `.oxlintrc.json`**

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "categories": {
    "correctness": "error",
    "suspicious": "warn"
  },
  "ignorePatterns": ["dist/", "node_modules/"]
}
```

- [ ] **Step 6: Verify install and lint run**

```bash
pnpm install && pnpm lint
```

Expected: install completes; `oxlint` runs and reports `Found 0 warnings and 0 errors` (no source yet).

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json .oxlintrc.json
git commit -m "chore: set up pnpm workspace and shared tooling"
```

---

### Task 2: `shared` package with core domain types

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

These are the stable entities from the spec's data model. Sync DTOs and merge types are intentionally deferred to the backend plan.

- [ ] **Step 1: Write `packages/shared/package.json`**

Consumed via source (`exports` points at `.ts`); no build step. Bundler/tsx resolve TS directly.

```json
{
  "name": "@kupi/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

- [ ] **Step 2: Write `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `packages/shared/src/index.ts`**

```typescript
export interface Account {
  id: string;
  createdAt: number;
}

export interface Device {
  id: string;
  accountId: string;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export type ListRole = "owner" | "member";

export interface List {
  id: string;
  name: string;
  ownerAccountId: string;
  seq: number;
  createdAt: number;
}

export interface Item {
  id: string;
  listId: string;
  name: string;
  quantity: number;
  categoryId: string | null;
  checked: boolean;
  version: number;
  deleted: boolean;
  updatedAt: number;
}
```

- [ ] **Step 4: Typecheck the package**

```bash
pnpm --filter @kupi/shared exec tsc --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add core domain types"
```

---

### Task 3: `server` package — Fastify skeleton with `/health` and SQLite

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/db.ts`
- Create: `packages/server/src/app.ts`
- Create: `packages/server/src/index.ts`
- Test: `packages/server/test/health.test.ts`

- [ ] **Step 1: Write `packages/server/package.json`**

```json
{
  "name": "@kupi/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "node --import tsx --test test/**/*.test.ts"
  }
}
```

- [ ] **Step 2: Install server dependencies**

```bash
pnpm --filter @kupi/server add fastify better-sqlite3 @kupi/shared@workspace:*
pnpm --filter @kupi/server add -D @types/better-sqlite3 @types/node
```

Expected: `fastify`, `better-sqlite3`, `@kupi/shared` (as `workspace:*`) in dependencies; types in devDependencies.

> **[execution fix]** pnpm 10 blocks native build scripts by default, so `better-sqlite3` won't compile and the server crashes at runtime. Add to the root `package.json`:
> ```json
> "pnpm": { "onlyBuiltDependencies": ["better-sqlite3", "esbuild"] }
> ```
> (`esbuild` is listed too — it's pulled in by Vite in Task 4.)

- [ ] **Step 3: Write `packages/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "declaration": false,
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

> **[execution fix]** dropped `rootDir: "src"` (conflicts with `include: ["test"]`) and added `declaration: false` (better-sqlite3's return type "cannot be named" when declarations are generated; the server is an app, not a library, so declarations aren't needed).

- [ ] **Step 4: Write `packages/server/src/db.ts`**

Single SQLite file. Schema is added in the backend plan; this just opens the connection.

```typescript
import Database from "better-sqlite3";

export function openDb(path = "kupi.db") {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export type Db = ReturnType<typeof openDb>;
```

- [ ] **Step 5: Write the failing test `packages/server/test/health.test.ts`**

`buildApp` accepts an in-memory db so tests never touch disk.

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { buildApp } from "../src/app.ts";

test("GET /health returns ok", async () => {
  const db = new Database(":memory:");
  const app = buildApp(db);

  const res = await app.inject({ method: "GET", url: "/health" });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: "ok" });

  await app.close();
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
pnpm --filter @kupi/server test
```

Expected: FAIL — cannot resolve `../src/app.ts` (module does not exist yet).

- [ ] **Step 7: Write `packages/server/src/app.ts`**

```typescript
import Fastify, { type FastifyInstance } from "fastify";
import type { Db } from "./db.ts";

export function buildApp(db: Db): FastifyInstance {
  const app = Fastify({ logger: false });

  // db is wired in now so feature routes in the backend plan can use it.
  app.decorate("db", db);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

```bash
pnpm --filter @kupi/server test
```

Expected: PASS — 1 test, 0 failures.

- [ ] **Step 9: Write `packages/server/src/index.ts`**

Entry point that opens the real db file and listens.

```typescript
import { openDb } from "./db.ts";
import { buildApp } from "./app.ts";

const db = openDb();
const app = buildApp(db);

const port = Number(process.env.PORT ?? 3000);

app
  .listen({ port, host: "0.0.0.0" })
  .then((addr) => app.log.info(`server listening on ${addr}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 10: Smoke-run the server manually**

```bash
pnpm dev:server
```

Expected: process stays up. In another shell: `curl localhost:3000/health` returns `{"status":"ok"}`. Stop with Ctrl-C. (`kupi.db` is created and gitignored.)

- [ ] **Step 11: Commit**

```bash
git add packages/server pnpm-lock.yaml package.json
git commit -m "feat(server): fastify skeleton with health endpoint and sqlite"
```

---

### Task 4: `client` package — Vite + React + PWA skeleton

**Files:**
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/index.html`
- Create: `packages/client/src/main.tsx`
- Create: `packages/client/src/App.tsx`

- [ ] **Step 1: Write `packages/client/package.json`**

```json
{
  "name": "@kupi/client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: Install client dependencies**

```bash
pnpm --filter @kupi/client add react react-dom @kupi/shared@workspace:*
pnpm --filter @kupi/client add -D vite @vitejs/plugin-react vite-plugin-pwa typescript @types/react @types/react-dom
```

Expected: runtime deps `react`, `react-dom`, `@kupi/shared`; dev deps for Vite/React/PWA/types.

- [ ] **Step 3: Write `packages/client/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "vite-plugin-pwa/client"],
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: Write `packages/client/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "kupi",
        short_name: "kupi",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
      },
    }),
  ],
});
```

- [ ] **Step 5: Write `packages/client/index.html`**

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>kupi</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write `packages/client/src/App.tsx`**

Imports a type from `@kupi/shared` to prove the workspace link resolves through the bundler.

```tsx
import type { List } from "@kupi/shared";

export function App() {
  const demo: List = {
    id: "demo",
    name: "Список покупок",
    ownerAccountId: "me",
    seq: 0,
    createdAt: Date.now(),
  };

  return <h1>{demo.name}</h1>;
}
```

- [ ] **Step 7: Write `packages/client/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Verify the client builds**

```bash
pnpm build
```

Expected: Vite build succeeds, emits `packages/client/dist/` including a generated service worker (`sw.js`) and `manifest.webmanifest`. The `@kupi/shared` import resolves with no error.

- [ ] **Step 9: Commit**

```bash
git add packages/client pnpm-lock.yaml package.json
git commit -m "feat(client): vite + react + pwa skeleton consuming shared"
```

---

### Task 5: Final verification of the whole workspace

- [ ] **Step 1: Run lint, typecheck, tests, build together**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all four pass — lint clean, typecheck clean across all packages, server health test passes, client build emits `dist/`.

- [ ] **Step 2: Commit any tooling fixes if the above required changes**

```bash
git add -A
git commit -m "chore: green workspace baseline"
```

---

## Notes for follow-up plans

- **Backend plan** adds: SQLite schema/migrations (`accounts`, `devices`, `link_codes`, `lists`, `list_members`, `list_invites`, `items`, `categories`, `item_frequency`), the cookie auth (`POST /accounts`, token validation middleware, sliding `Set-Cookie`), device linking, list sharing + access isolation, the `/lists/:id/sync` protocol with per-field LWW + tombstones + `client_op_id` idempotency, frequency-based suggestions, and the Sync DTO types in `shared`.
- **Client plan** adds: IndexedDB cache + pending queue (`idb`), optimistic UI reducer, background sync on open / `online` event, autocomplete by popularity, offline/sync indicator, `navigator.storage.persist()`.
