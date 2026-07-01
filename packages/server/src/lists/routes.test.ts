import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { List } from '@kupi/shared';

import { makeApp, signup } from '@/shared/test-helpers';

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

test('owner deletes list — gone for owner and all members', async () => {
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
  await app.inject({
    method: 'POST',
    url: '/lists/join',
    headers: { cookie: guest.cookie },
    payload: { code },
  });

  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/lists/${listId}`,
    headers: { cookie: owner.cookie },
  });
  assert.equal(deleteRes.statusCode, 204);

  const ownerLists = (
    await app.inject({
      method: 'GET',
      url: '/lists',
      headers: { cookie: owner.cookie },
    })
  ).json() as List[];
  assert.equal(
    ownerLists.some((l) => l.id === listId),
    false,
  );

  const guestLists = (
    await app.inject({
      method: 'GET',
      url: '/lists',
      headers: { cookie: guest.cookie },
    })
  ).json() as List[];
  assert.equal(
    guestLists.some((l) => l.id === listId),
    false,
  );

  await app.close();
});

test('member leaves list — list still exists for owner', async () => {
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
  await app.inject({
    method: 'POST',
    url: '/lists/join',
    headers: { cookie: guest.cookie },
    payload: { code },
  });

  const leaveRes = await app.inject({
    method: 'DELETE',
    url: `/lists/${listId}`,
    headers: { cookie: guest.cookie },
  });
  assert.equal(leaveRes.statusCode, 204);

  const guestLists = (
    await app.inject({
      method: 'GET',
      url: '/lists',
      headers: { cookie: guest.cookie },
    })
  ).json() as List[];
  assert.equal(
    guestLists.some((l) => l.id === listId),
    false,
  );

  const ownerLists = (
    await app.inject({
      method: 'GET',
      url: '/lists',
      headers: { cookie: owner.cookie },
    })
  ).json() as List[];
  assert.equal(
    ownerLists.some((l) => l.id === listId),
    true,
  );

  await app.close();
});

test('non-member cannot delete list (404)', async () => {
  const app = makeApp();
  const owner = await signup(app);
  const outsider = await signup(app);
  const listId = owner.bootstrap.lists[0]!.id;

  const res = await app.inject({
    method: 'DELETE',
    url: `/lists/${listId}`,
    headers: { cookie: outsider.cookie },
  });
  assert.equal(res.statusCode, 404);

  await app.close();
});

test('GET /lists/:id/members returns member count, grows as accounts join', async () => {
  const app = makeApp();
  const owner = await signup(app);
  const guest = await signup(app);
  const listId = owner.bootstrap.lists[0]!.id;

  const before = await app.inject({
    method: 'GET',
    url: `/lists/${listId}/members`,
    headers: { cookie: owner.cookie },
  });
  assert.deepEqual(before.json(), { count: 1 });

  const inviteRes = await app.inject({
    method: 'POST',
    url: `/lists/${listId}/invites`,
    headers: { cookie: owner.cookie },
  });
  const { code } = inviteRes.json() as { code: string };
  await app.inject({
    method: 'POST',
    url: '/lists/join',
    headers: { cookie: guest.cookie },
    payload: { code },
  });

  const after = await app.inject({
    method: 'GET',
    url: `/lists/${listId}/members`,
    headers: { cookie: owner.cookie },
  });
  assert.deepEqual(after.json(), { count: 2 });

  await app.close();
});

test('GET /lists/:id/members is 404 for non-members', async () => {
  const app = makeApp();
  const owner = await signup(app);
  const outsider = await signup(app);
  const listId = owner.bootstrap.lists[0]!.id;

  const res = await app.inject({
    method: 'GET',
    url: `/lists/${listId}/members`,
    headers: { cookie: outsider.cookie },
  });
  assert.equal(res.statusCode, 404);

  await app.close();
});
