import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildApp } from '@/app';
import { COOKIE } from '@/auth/auth';

test('protected route returns 401 without a cookie', async () => {
  const app = await buildApp(new Database(':memory:'));
  const res = await app.inject({ method: 'GET', url: '/api/lists' });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('valid device token authenticates and refreshes the cookie', async () => {
  const sqlite = new Database(':memory:');
  const app = await buildApp(sqlite);

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

  assert.equal(res.statusCode, 200);
  const set = res.cookies.find((cookie) => cookie.name === COOKIE);
  assert.ok(set, 'ожидаем обновлённый Set-Cookie');
  assert.equal(set?.value, 'tok');
  assert.equal(set?.maxAge, 400 * 24 * 60 * 60);

  await app.close();
});

test('cookie не продлевается на отклонённом запросе (404 на чужой список)', async () => {
  const sqlite = new Database(':memory:');
  const app = await buildApp(sqlite);

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
    method: 'PATCH',
    url: '/api/lists/does-not-exist',
    headers: { cookie: `${COOKIE}=tok` },
    payload: { name: 'x' },
  });

  assert.equal(res.statusCode, 404);
  const set = res.cookies.find((cookie) => cookie.name === COOKIE);
  assert.equal(set, undefined, 'на 404 куку продлевать не должны');

  await app.close();
});
