import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import type { List } from '@kupi/shared';
import { CodeBodySchema, ListParamsSchema, NameBodySchema } from '@kupi/shared';

import {
  countListMembers,
  deleteList,
  findListById,
  findListInviteByCode,
  findListsForAccount,
  insertList,
  insertListInvite,
  insertListMember,
  isMember,
  isOwner,
  removeListMember,
  updateListName,
} from '@/lists/repository';
import { newCode, newId } from '@/shared/ids';

// TTL приглашения — 7 дней в миллисекундах
const INVITE_TTL = 7 * 24 * 60 * 60 * 1000;

export function listRoutes(app: FastifyInstance): void {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // GET /lists — возвращает все списки, к которым имеет доступ текущий пользователь
  typedApp.get('/lists', async (req): Promise<List[]> => {
    return findListsForAccount(app.db, req.accountId);
  });

  // POST /lists — создаёт новый список и добавляет создателя владельцем
  typedApp.post(
    '/lists',
    { schema: { body: NameBodySchema } },
    async (req, reply) => {
      const id = newId();
      const now = Date.now();
      await app.db.transaction().execute(async (trx) => {
        await insertList(trx, {
          id,
          name: req.body.name,
          ownerAccountId: req.accountId,
          createdAt: now,
        });
        await insertListMember(trx, {
          listId: id,
          accountId: req.accountId,
          role: 'owner',
        });
      });
      reply.code(201);
      return findListById(app.db, id);
    },
  );

  // PATCH /lists/:id — обновляет имя списка (только для членов, 404 для не-членов)
  typedApp.patch(
    '/lists/:id',
    { schema: { params: ListParamsSchema, body: NameBodySchema } },
    async (req, reply) => {
      if (!(await isMember(app.db, req.params.id, req.accountId))) {
        return reply.code(404).send({ error: 'not_found' });
      }
      await updateListName(app.db, req.params.id, req.body.name);
      return findListById(app.db, req.params.id);
    },
  );

  // POST /lists/:id/invites — генерирует код приглашения (только для владельцев)
  typedApp.post(
    '/lists/:id/invites',
    { schema: { params: ListParamsSchema } },
    async (req, reply) => {
      if (!(await isOwner(app.db, req.params.id, req.accountId))) {
        return reply.code(404).send({ error: 'not_found' });
      }
      const code = newCode(8);
      await insertListInvite(app.db, {
        code,
        listId: req.params.id,
        expiresAt: Date.now() + INVITE_TTL,
      });
      return { code };
    },
  );

  // POST /lists/join — присоединяется к списку по коду приглашения
  typedApp.post(
    '/lists/join',
    { schema: { body: CodeBodySchema } },
    async (req, reply) => {
      const invite = await findListInviteByCode(app.db, req.body.code);
      if (!invite || invite.expiresAt < Date.now()) {
        return reply.code(400).send({ error: 'invalid_code' });
      }
      await insertListMember(app.db, {
        listId: invite.listId,
        accountId: req.accountId,
        role: 'member',
      });
      return findListById(app.db, invite.listId);
    },
  );

  // DELETE /lists/:id — владелец удаляет список целиком, участник выходит из него
  typedApp.delete(
    '/lists/:id',
    { schema: { params: ListParamsSchema } },
    async (req, reply) => {
      if (!(await isMember(app.db, req.params.id, req.accountId))) {
        return reply.code(404).send({ error: 'not_found' });
      }
      if (await isOwner(app.db, req.params.id, req.accountId)) {
        await app.db.transaction().execute(async (trx) => {
          await deleteList(trx, req.params.id);
        });
      } else {
        await removeListMember(app.db, req.params.id, req.accountId);
      }
      return reply.code(204).send();
    },
  );

  // GET /lists/:id/members — число участников списка (без имён, только count)
  typedApp.get(
    '/lists/:id/members',
    { schema: { params: ListParamsSchema } },
    async (req, reply) => {
      if (!(await isMember(app.db, req.params.id, req.accountId))) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return { count: await countListMembers(app.db, req.params.id) };
    },
  );
}
