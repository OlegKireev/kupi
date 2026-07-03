import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

import type { Bootstrap } from '@kupi/shared';

import { buildApp } from '@/app';
import { COOKIE } from '@/auth/auth';

/**
 * Создаёт новый Fastify app с in-memory БД.
 * Удобно для тестов — каждый тест получает изолированное состояние.
 * foreign_keys включён явно — иначе тесты не ловят нарушения FK, которые
 * реальный сервер (db/connection.ts's openSqlite) enforce-ит всегда.
 */
export function makeApp(): Promise<FastifyInstance> {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  return buildApp(sqlite);
}

/**
 * Регистрирует нового анонимного пользователя (POST /accounts)
 * и возвращает cookie-строку и bootstrap-данные.
 * Удобен для подготовки авторизованного состояния в тестах.
 */
export async function signup(
  app: FastifyInstance,
): Promise<{ cookie: string; bootstrap: Bootstrap }> {
  const res = await app.inject({ method: 'POST', url: '/api/accounts' });
  const deviceCookie = res.cookies.find((cookie) => cookie.name === COOKIE)!;
  return {
    cookie: `${COOKIE}=${deviceCookie.value}`,
    bootstrap: res.json() as Bootstrap,
  };
}
