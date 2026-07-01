import type { FastifyInstance } from 'fastify';

import type { Bootstrap, Category } from '@kupi/shared';

import { buildBootstrap } from '@/accounts/bootstrap';
import { findCategories, insertAccount } from '@/accounts/repository';
import { setAuthCookie } from '@/auth/auth';
import { insertDevice } from '@/auth/repository';
import { insertList, insertListMember } from '@/lists/repository';
import { newId, newToken } from '@/shared/ids';

/**
 * POST /accounts: Создаёт новый анонимный аккаунт
 * - генерирует accountId, deviceId, deviceToken и listId
 * - в одной транзакции создаёт accounts, devices, lists, list_members записи
 * - дефолтный список "Мои покупки" с owner-членством
 * - устанавливает auth cookie
 * - возвращает bootstrap (аккаунт + список + категории)
 *
 * GET /categories: Возвращает пресет категорий
 * Требует аутентификацию (не в PUBLIC)
 */
export function accountRoutes(app: FastifyInstance): void {
  // POST /accounts: анонимная регистрация
  app.post('/accounts', async (_req, reply): Promise<Bootstrap> => {
    const now = Date.now();
    const accountId = newId();
    const token = newToken();
    const deviceId = newId();
    const listId = newId();

    // Вся логика в одной транзакции
    await app.db.transaction().execute(async (trx) => {
      // Создаём аккаунт
      await insertAccount(trx, { id: accountId, createdAt: now });

      // Создаём первое устройство с токеном
      await insertDevice(trx, {
        id: deviceId,
        accountId,
        token,
        createdAt: now,
      });

      // Создаём дефолтный список "Мои покупки"
      await insertList(trx, {
        id: listId,
        name: 'Мои покупки',
        ownerAccountId: accountId,
        createdAt: now,
      });

      // Добавляем аккаунт как owner в дефолтный список
      await insertListMember(trx, { listId, accountId, role: 'owner' });
    });

    // Ставим auth cookie
    setAuthCookie(reply, token);

    // Возвращаем 201 Created и bootstrap
    reply.code(201);
    return buildBootstrap(app.db, accountId);
  });

  // GET /categories: публичный пресет (требует аутентификацию, см. registerAuth)
  app.get('/categories', async (): Promise<Category[]> => {
    return findCategories(app.db);
  });
}
