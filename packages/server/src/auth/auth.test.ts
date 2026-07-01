import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildApp } from '@/app';
import { COOKIE } from '@/auth/auth';

test('protected route returns 401 without a cookie', async () => {
  const app = buildApp(new Database(':memory:'));
  const res = await app.inject({ method: 'GET', url: '/api/lists' });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('valid device token authenticates and refreshes the cookie', async () => {
  const sqlite = new Database(':memory:');
  const app = buildApp(sqlite);

  const now = Date.now();
  sqlite
    .prepare("INSERT INTO accounts (id, created_at) VALUES ('a1', ?)")
    .run(now);
  sqlite
    .prepare(
      "INSERT INTO devices (id, account_id, token, created_at) VALUES ('d1', 'a1', 'tok', ?)",
    )
    .run(now);

  const res = await app.inject({
    method: 'GET',
    url: '/api/lists',
    headers: { cookie: `${COOKIE}=tok` },
  });

  // /lists появится в Task 6; до него хук пропустит аутентификацию и вернёт 404 (не 401)
  assert.notEqual(res.statusCode, 401);
  const set = res.cookies.find((cookie) => cookie.name === COOKIE);
  assert.ok(set, 'ожидаем обновлённый Set-Cookie');
  assert.equal(set?.value, 'tok');
  assert.equal(set?.maxAge, 400 * 24 * 60 * 60);

  await app.close();
});
