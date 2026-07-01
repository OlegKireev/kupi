import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { List } from '@kupi/shared';

import { makeApp, signup } from './helpers';

test("GET /lists returns only the caller's lists", async () => {
  const app = makeApp();
  const a = await signup(app);

  const res = await app.inject({
    method: 'GET',
    url: '/lists',
    headers: { cookie: a.cookie },
  });
  const lists = res.json() as List[];
  assert.equal(lists.length, 1);
  assert.equal(lists[0]?.id, a.bootstrap.lists[0]?.id);

  await app.close();
});

test('owner invites, second account joins and gains access', async () => {
  const app = makeApp();
  const owner = await signup(app);
  const guest = await signup(app);
  const listId = owner.bootstrap.lists[0]!.id;

  const inviteRes = await app.inject({
    method: 'POST',
    url: `/lists/${listId}/invites`,
    headers: { cookie: owner.cookie },
  });
  const { code } = inviteRes.json() as { code: string };

  const joinRes = await app.inject({
    method: 'POST',
    url: '/lists/join',
    headers: { cookie: guest.cookie },
    payload: { code },
  });
  assert.equal(joinRes.statusCode, 200);

  const guestLists = (
    await app.inject({
      method: 'GET',
      url: '/lists',
      headers: { cookie: guest.cookie },
    })
  ).json() as List[];
  assert.ok(guestLists.some((l) => l.id === listId));

  await app.close();
});

test('non-member cannot rename or invite (isolation, 404)', async () => {
  const app = makeApp();
  const owner = await signup(app);
  const outsider = await signup(app);
  const listId = owner.bootstrap.lists[0]!.id;

  const rename = await app.inject({
    method: 'PATCH',
    url: `/lists/${listId}`,
    headers: { cookie: outsider.cookie },
    payload: { name: 'взлом' },
  });
  assert.equal(rename.statusCode, 404);

  const invite = await app.inject({
    method: 'POST',
    url: `/lists/${listId}/invites`,
    headers: { cookie: outsider.cookie },
  });
  assert.equal(invite.statusCode, 404);

  await app.close();
});

test('POST /lists with an empty name is rejected by validation (400)', async () => {
  const app = makeApp();
  const { cookie } = await signup(app);
  const res = await app.inject({
    method: 'POST',
    url: '/lists',
    headers: { cookie },
    payload: { name: '' },
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});
