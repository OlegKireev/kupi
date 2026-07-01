import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import type { Suggestion, SyncResponse } from '@kupi/shared';
import {
  ListParamsSchema,
  SuggestQuerySchema,
  SyncRequestSchema,
} from '@kupi/shared';

import { findListById, isMember } from '@/lists/repository';
import { normalizeName } from '@/shared/ids';
import { applyChange } from '@/sync/merge';
import { findItemsSince, findSuggestions } from '@/sync/repository';

export function syncRoutes(app: FastifyInstance): void {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  /**
   * POST /lists/:id/sync
   * Принимает батч клиентских изменений, применяет в одной транзакции,
   * возвращает новый seq и все items с version > lastSeenSeq (включая tombstones).
   */
  typedApp.post(
    '/lists/:id/sync',
    { schema: { params: ListParamsSchema, body: SyncRequestSchema } },
    async (req, reply) => {
      const listId = req.params.id;
      if (!(await isMember(app.db, listId, req.accountId))) {
        return reply.code(404).send({ error: 'not_found' });
      }

      const { lastSeenSeq, changes } = req.body;

      // Все изменения применяются атомарно в одной транзакции
      await app.db.transaction().execute(async (trx) => {
        for (const change of changes) {
          await applyChange(trx, listId, req.accountId, change);
        }
      });

      const list = await findListById(app.db, listId);

      // Дельта-pull: всё с version > lastSeenSeq, включая tombstones
      const items = await findItemsSince(app.db, listId, lastSeenSeq);

      const body: SyncResponse = { seq: list!.seq, items };
      return body;
    },
  );

  /**
   * GET /suggestions?q=
   * Возвращает наиболее часто используемые имена текущего пользователя по префиксу.
   * Поиск ведётся по нормализованному имени (lowercase, без пробелов).
   */
  typedApp.get(
    '/suggestions',
    { schema: { querystring: SuggestQuerySchema } },
    async (req) => {
      const query = normalizeName(req.query.q ?? '');
      if (!query) return [] as Suggestion[];
      return findSuggestions(app.db, req.accountId, query);
    },
  );
}
