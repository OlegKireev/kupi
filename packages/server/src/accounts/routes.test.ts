import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeApp, signup } from '@/shared/test-helpers';

test('POST /accounts creates account, cookie, and a default list', async () => {
  const app = makeApp();
  const { cookie, bootstrap } = await signup(app);

  // Проверяем, что получили куку аутентификации
  assert.ok(cookie.startsWith('kupi_dt='));

  // Проверяем структуру bootstrap
  assert.ok(bootstrap.account.id);
  assert.equal(bootstrap.lists.length, 1);
  assert.equal(bootstrap.lists[0]?.name, 'Мои покупки');
  assert.equal(bootstrap.lists[0]?.ownerAccountId, bootstrap.account.id);
  assert.equal(bootstrap.categories.length, 9);

  await app.close();
});

test('two signups get isolated accounts and distinct lists', async () => {
  const app = makeApp();
  const a = await signup(app);
  const b = await signup(app);

  // Аккаунты разные
  assert.notEqual(a.bootstrap.account.id, b.bootstrap.account.id);

  // Списки разные
  assert.notEqual(a.bootstrap.lists[0]?.id, b.bootstrap.lists[0]?.id);

  await app.close();
});

test('GET /categories requires auth and returns the preset', async () => {
  const app = makeApp();
  const { cookie } = await signup(app);

  // Без куки: 401
  const unauth = await app.inject({ method: 'GET', url: '/categories' });
  assert.equal(unauth.statusCode, 401);

  // С куки: 200 и 9 категорий
  const res = await app.inject({
    method: 'GET',
    url: '/categories',
    headers: { cookie },
  });
  assert.equal(res.statusCode, 200);
  assert.equal((res.json() as unknown[]).length, 9);

  await app.close();
});
