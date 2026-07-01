import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { CodeBodySchema } from '@kupi/shared';

import { buildBootstrap } from '@/accounts/bootstrap';
import { setAuthCookie } from '@/auth/auth';
import { insertDevice } from '@/auth/repository';
import {
  deleteLinkCode,
  findLinkCodeByCode,
  insertLinkCode,
} from '@/link/repository';
import { newCode, newId, newToken } from '@/shared/ids';

const LINK_TTL = 10 * 60 * 1000;

/**
 * Регистрирует роуты для связывания устройств.
 *
 * POST /link-codes (protected) — генерирует одноразовый код для связывания.
 * POST /link (public) — валидирует код, создаёт новое устройство, выдаёт cookie.
 */
export function linkRoutes(app: FastifyInstance): void {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  /**
   * POST /link-codes (protected, требует auth)
   * Генерирует 6-значный код с TTL 10 минут.
   * Возвращает { code: "ABC123" }
   */
  typedApp.post('/link-codes', async (req) => {
    const code = newCode(6);
    const expiresAt = Date.now() + LINK_TTL;
    await insertLinkCode(app.db, { code, accountId: req.accountId, expiresAt });
    return { code };
  });

  /**
   * POST /link (public, БЕЗ auth)
   * Валидирует код через CodeBodySchema, погашает его (DELETE), создаёт новое устройство,
   * выдаёт ему cookie, возвращает общий bootstrap для аккаунта.
   * Ошибки: 400 если код невалидный, истёк или уже использован.
   */
  typedApp.post(
    '/link',
    { schema: { body: CodeBodySchema } },
    async (req, reply) => {
      const { code } = req.body;

      // Резолвим код
      const linkCode = await findLinkCodeByCode(app.db, code);

      // Проверяем существование и TTL
      if (!linkCode || linkCode.expiresAt < Date.now()) {
        return reply.code(400).send({ error: 'invalid_code' });
      }

      // Транзакция: создаём устройство и удаляем код (одноразовый)
      const token = newToken();
      const deviceId = newId();

      await app.db.transaction().execute(async (trx) => {
        await insertDevice(trx, {
          id: deviceId,
          accountId: linkCode.accountId,
          token,
          createdAt: Date.now(),
        });
        await deleteLinkCode(trx, code);
      });

      // Выдаём cookie новому устройству
      setAuthCookie(reply, token);

      // Возвращаем bootstrap (аккаунт, списки, категории)
      return buildBootstrap(app.db, linkCode.accountId);
    },
  );
}
