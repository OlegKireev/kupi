import { test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { makeApp, signup } from "./helpers";
import type { SyncResponse } from "@kupi/shared";

function sync(
  app: FastifyInstance,
  cookie: string,
  listId: string,
  body: Record<string, unknown>,
) {
  return app.inject({
    method: "POST",
    url: `/lists/${listId}/sync`,
    headers: { cookie },
    payload: body,
  });
}

test("create item, then delta-pull only sees it above last_seen_seq", async () => {
  const app = makeApp();
  const u = await signup(app);
  const listId = u.bootstrap.lists[0]!.id;

  const res = await sync(app, u.cookie, listId, {
    lastSeenSeq: 0,
    changes: [
      { itemId: "i1", clientOpId: "op1", op: "upsert", fields: { name: "Молоко", quantity: 2 } },
    ],
  });
  const body = res.json() as SyncResponse;
  assert.equal(body.seq, 1);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0]?.name, "Молоко");

  const empty = await sync(app, u.cookie, listId, { lastSeenSeq: body.seq, changes: [] });
  assert.equal((empty.json() as SyncResponse).items.length, 0);

  await app.close();
});

test("edits to different fields both survive (column-wise patch)", async () => {
  const app = makeApp();
  const u = await signup(app);
  const listId = u.bootstrap.lists[0]!.id;

  await sync(app, u.cookie, listId, {
    lastSeenSeq: 0,
    changes: [{ itemId: "i1", clientOpId: "c0", op: "upsert", fields: { name: "Хлеб", quantity: 1 } }],
  });
  await sync(app, u.cookie, listId, {
    lastSeenSeq: 0,
    changes: [{ itemId: "i1", clientOpId: "c1", op: "upsert", fields: { quantity: 5 } }],
  });
  const res = await sync(app, u.cookie, listId, {
    lastSeenSeq: 0,
    changes: [{ itemId: "i1", clientOpId: "c2", op: "upsert", fields: { categoryId: "bread" } }],
  });

  const item = (res.json() as SyncResponse).items.find((i) => i.id === "i1")!;
  assert.equal(item.name, "Хлеб");
  assert.equal(item.quantity, 5);
  assert.equal(item.categoryId, "bread");

  await app.close();
});

test("remove wins: a deleted item is not resurrected by a later edit", async () => {
  const app = makeApp();
  const u = await signup(app);
  const listId = u.bootstrap.lists[0]!.id;

  await sync(app, u.cookie, listId, {
    lastSeenSeq: 0,
    changes: [{ itemId: "i1", clientOpId: "c0", op: "upsert", fields: { name: "Соль" } }],
  });
  await sync(app, u.cookie, listId, {
    lastSeenSeq: 0,
    changes: [{ itemId: "i1", clientOpId: "c1", op: "delete", fields: {} }],
  });
  const res = await sync(app, u.cookie, listId, {
    lastSeenSeq: 0,
    changes: [{ itemId: "i1", clientOpId: "c2", op: "upsert", fields: { checked: true } }],
  });

  const item = (res.json() as SyncResponse).items.find((i) => i.id === "i1")!;
  assert.equal(item.deleted, true);
  assert.equal(item.checked, false);

  await app.close();
});

test("replaying the same clientOpId is idempotent", async () => {
  const app = makeApp();
  const u = await signup(app);
  const listId = u.bootstrap.lists[0]!.id;

  const change = {
    lastSeenSeq: 0,
    changes: [{ itemId: "i1", clientOpId: "dup", op: "upsert", fields: { name: "Сахар", quantity: 1 } }],
  };
  await sync(app, u.cookie, listId, change);
  const second = await sync(app, u.cookie, listId, change);

  const items = (second.json() as SyncResponse).items.filter((i) => i.id === "i1");
  assert.equal(items.length, 1);
  assert.equal(items[0]?.quantity, 1);

  await app.close();
});

test("non-member cannot sync (404)", async () => {
  const app = makeApp();
  const owner = await signup(app);
  const outsider = await signup(app);
  const listId = owner.bootstrap.lists[0]!.id;

  const res = await sync(app, outsider.cookie, listId, { lastSeenSeq: 0, changes: [] });
  assert.equal(res.statusCode, 404);

  await app.close();
});

test("malformed sync body is rejected by validation (400)", async () => {
  const app = makeApp();
  const u = await signup(app);
  const listId = u.bootstrap.lists[0]!.id;

  const res = await sync(app, u.cookie, listId, {
    lastSeenSeq: 0,
    changes: [{ itemId: "i1", op: "upsert" }], // нет clientOpId
  });
  assert.equal(res.statusCode, 400);

  await app.close();
});

test("adding items feeds frequency-ranked suggestions", async () => {
  const app = makeApp();
  const u = await signup(app);
  const listId = u.bootstrap.lists[0]!.id;

  await sync(app, u.cookie, listId, {
    lastSeenSeq: 0,
    changes: [
      { itemId: "i1", clientOpId: "a1", op: "upsert", fields: { name: "Молоко" } },
      { itemId: "i2", clientOpId: "a2", op: "upsert", fields: { name: "Молоко" } },
      { itemId: "i3", clientOpId: "a3", op: "upsert", fields: { name: "Мука" } },
    ],
  });

  const res = await app.inject({
    method: "GET",
    url: "/suggestions?q=мол",
    headers: { cookie: u.cookie },
  });
  const rows = res.json() as Array<{ name: string; count: number }>;
  assert.equal(rows[0]?.name, "молоко");
  assert.equal(rows[0]?.count, 2);

  await app.close();
});
