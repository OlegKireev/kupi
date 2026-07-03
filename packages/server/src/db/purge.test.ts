import assert from 'node:assert/strict';
import { test } from 'node:test';

import { purgeStaleData, RETENTION_MS } from '@/db/purge';
import { makeApp, signup } from '@/shared/test-helpers';

test('purgeStaleData удаляет applied_ops старше окна хранения', async () => {
  const app = await makeApp();
  const { cookie, bootstrap } = await signup(app);
  const listId = bootstrap.lists[0]!.id;

  await app.inject({
    method: 'POST',
    url: `/api/lists/${listId}/sync`,
    headers: { cookie },
    payload: {
      lastSeenSeq: 0,
      changes: [
        {
          clientOpId: 'op-1',
          itemId: 'item-1',
          op: 'upsert',
          fields: { name: 'Молоко' },
        },
      ],
    },
  });

  const now = Date.now();
  await purgeStaleData(app.db, now + RETENTION_MS + 1);

  const remaining = await app.db
    .selectFrom('appliedOps')
    .selectAll()
    .execute();
  assert.deepEqual(remaining, []);

  await app.close();
});

test('purgeStaleData удаляет только старые tombstones, не живые items', async () => {
  const app = await makeApp();
  const { cookie, bootstrap } = await signup(app);
  const listId = bootstrap.lists[0]!.id;

  await app.inject({
    method: 'POST',
    url: `/api/lists/${listId}/sync`,
    headers: { cookie },
    payload: {
      lastSeenSeq: 0,
      changes: [
        {
          clientOpId: 'op-1',
          itemId: 'item-1',
          op: 'upsert',
          fields: { name: 'Молоко' },
        },
        {
          clientOpId: 'op-2',
          itemId: 'item-2',
          op: 'upsert',
          fields: { name: 'Хлеб' },
        },
      ],
    },
  });
  await app.inject({
    method: 'POST',
    url: `/api/lists/${listId}/sync`,
    headers: { cookie },
    payload: {
      lastSeenSeq: 2,
      changes: [{ clientOpId: 'op-3', itemId: 'item-1', op: 'delete' }],
    },
  });

  const now = Date.now();
  await purgeStaleData(app.db, now + RETENTION_MS + 1);

  const items = await app.db
    .selectFrom('items')
    .select(['id', 'deleted'])
    .execute();
  assert.deepEqual(items, [{ id: 'item-2', deleted: 0 }]);

  await app.close();
});

test('purgeStaleData не трогает данные внутри окна хранения', async () => {
  const app = await makeApp();
  const { cookie, bootstrap } = await signup(app);
  const listId = bootstrap.lists[0]!.id;

  await app.inject({
    method: 'POST',
    url: `/api/lists/${listId}/sync`,
    headers: { cookie },
    payload: {
      lastSeenSeq: 0,
      changes: [
        {
          clientOpId: 'op-1',
          itemId: 'item-1',
          op: 'upsert',
          fields: { name: 'Молоко' },
        },
      ],
    },
  });

  await purgeStaleData(app.db, Date.now());

  const ops = await app.db.selectFrom('appliedOps').selectAll().execute();
  assert.equal(ops.length, 1);

  await app.close();
});
