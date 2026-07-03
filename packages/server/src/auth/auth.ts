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
 * Регистрирует cookie-плагин и хуки аутентификации.
 * Для защищённых роутов onRequest резолвит device-токен из cookie в request.accountId.
 * Проводит sliding renewal: продлевает TTL куки, но только на успешном (2xx)
 * ответе — так TTL не продлевается на запросах, которые хендлер отклоняет
 * (например 404 на чужой список).
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
  });

  app.addHook('onSend', async (req, reply, payload) => {
    if (req.accountId && reply.statusCode >= 200 && reply.statusCode < 300) {
      const token = req.cookies[COOKIE];
      if (token) setAuthCookie(reply, token);
    }
    return payload;
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    // ID аккаунта, привязанный к device-токену из cookie
    accountId: string;
  }
}
