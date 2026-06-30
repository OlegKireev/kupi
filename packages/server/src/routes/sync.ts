import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Suggestion, SyncResponse } from "@kupi/shared";
import { ListParamsSchema, SuggestQuerySchema, SyncRequestSchema } from "@kupi/shared";
import { isMember } from "@/access";
import { applyChange } from "@/merge";
import { rowToItem } from "@/map";
import { normalizeName } from "@/ids";

export function syncRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * POST /lists/:id/sync
   * Принимает батч клиентских изменений, применяет в одной транзакции,
   * возвращает новый seq и все items с version > lastSeenSeq (включая tombstones).
   */
  r.post(
    "/lists/:id/sync",
    { schema: { params: ListParamsSchema, body: SyncRequestSchema } },
    async (req, reply) => {
      const listId = req.params.id;
      if (!isMember(app.db, listId, req.accountId)) {
        return reply.code(404).send({ error: "not_found" });
      }

      const { lastSeenSeq, changes } = req.body;

      // Все изменения применяются атомарно в одной транзакции
      app.db.transaction(() => {
        for (const ch of changes) applyChange(app.db, listId, req.accountId, ch);
      })();

      const seq = (
        app.db.prepare("SELECT seq FROM lists WHERE id = ?").get(listId) as { seq: number }
      ).seq;

      // Дельта-pull: всё с version > lastSeenSeq, включая tombstones
      const items = (
        app.db
          .prepare("SELECT * FROM items WHERE list_id = ? AND version > ? ORDER BY version")
          .all(listId, lastSeenSeq) as any[]
      ).map(rowToItem);

      const body: SyncResponse = { seq, items };
      return body;
    },
  );

  /**
   * GET /suggestions?q=
   * Возвращает наиболее часто используемые имена текущего пользователя по префиксу.
   * Поиск ведётся по нормализованному имени (lowercase, без пробелов).
   */
  r.get("/suggestions", { schema: { querystring: SuggestQuerySchema } }, async (req) => {
    const q = normalizeName(req.query.q ?? "");
    if (!q) return [] as Suggestion[];
    return app.db
      .prepare(
        `SELECT normalized_name AS name, count FROM item_frequency
         WHERE account_id = ? AND normalized_name LIKE ?
         ORDER BY count DESC, normalized_name
         LIMIT 10`,
      )
      .all(req.accountId, `${q}%`) as Suggestion[];
  });
}
