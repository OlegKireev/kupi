import cookie from '@fastify/cookie';
import type { FastifyInstance, FastifyReply } from 'fastify';

import { findDeviceByToken } from '@/auth/repository';

export const COOKIE = 'kupi_dt';
const MAX_AGE = 400 * 24 * 60 * 60; // 400 дней — cap Chrome для Max-Age

const cookieOpts = () =>
  ({
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  }) as const;

/**
 * Устанавливает cookie с device-токеном для аутентификации.
 * Используется при создании нового устройства (/accounts/link).
 */
export function setAuthCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(COOKIE, token, cookieOpts());
}

// Публичные пути, не требующие аутентификации
const PUBLIC = new Set(['/api/health', '/api/accounts', '/api/link']);

/**
 * Регистрирует cookie-плагин и onRequest-хук для аутентификации.
 * Для защищённых роутов хук резолвит device-токен из cookie в request.accountId.
 * Проводит sliding renewal: продлевает TTL куки на каждом авторизованном запросе.
 */
export function registerAuth(app: FastifyInstance): void {
  app.register(cookie);
  app.decorateRequest('accountId', '');

  app.addHook('onRequest', async (req, reply) => {
    // Пропускаем публичные пути
    const path = req.url.split('?')[0] ?? req.url;
    if (PUBLIC.has(path)) return;

    // Резолвим device-токен из cookie
    const token = req.cookies[COOKIE];
    const device = token ? await findDeviceByToken(app.db, token) : undefined;

    if (!device) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    // Привязываем account_id к реквесту
    req.accountId = device.accountId;

    // Sliding renewal: продлеваем TTL куки, значение то же
    setAuthCookie(reply, token!);
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    // ID аккаунта, привязанный к device-токену из cookie
    accountId: string;
  }
}
