import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { List } from "@kupi/shared";
import { CodeBodySchema, ListParamsSchema, NameBodySchema } from "@kupi/shared";
import { newCode, newId } from "@/ids";
import { isMember, isOwner } from "@/access";
import { rowToList } from "@/map";

// TTL приглашения — 7 дней в миллисекундах
const INVITE_TTL = 7 * 24 * 60 * 60 * 1000;

export function listRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET /lists — возвращает все списки, к которым имеет доступ текущий пользователь
  r.get("/lists", async (req): Promise<List[]> => {
    return (
      app.db
        .prepare(
          `SELECT l.* FROM lists l
           JOIN list_members m ON m.list_id = l.id
           WHERE m.account_id = ?
           ORDER BY l.created_at`,
        )
        .all(req.accountId) as any[]
    ).map(rowToList);
  });

  // POST /lists — создаёт новый список и добавляет создателя владельцем
  r.post("/lists", { schema: { body: NameBodySchema } }, async (req, reply) => {
    const id = newId();
    const now = Date.now();
    app.db.transaction(() => {
      app.db
        .prepare(
          "INSERT INTO lists (id, name, owner_account_id, seq, created_at) VALUES (?, ?, ?, 0, ?)",
        )
        .run(id, req.body.name, req.accountId, now);
      app.db
        .prepare("INSERT INTO list_members (list_id, account_id, role) VALUES (?, ?, 'owner')")
        .run(id, req.accountId);
    })();
    reply.code(201);
    return rowToList(app.db.prepare("SELECT * FROM lists WHERE id = ?").get(id));
  });

  // PATCH /lists/:id — обновляет имя списка (только для членов, 404 для не-членов)
  r.patch(
    "/lists/:id",
    { schema: { params: ListParamsSchema, body: NameBodySchema } },
    async (req, reply) => {
      if (!isMember(app.db, req.params.id, req.accountId)) {
        return reply.code(404).send({ error: "not_found" });
      }
      app.db.prepare("UPDATE lists SET name = ? WHERE id = ?").run(req.body.name, req.params.id);
      return rowToList(app.db.prepare("SELECT * FROM lists WHERE id = ?").get(req.params.id));
    },
  );

  // POST /lists/:id/invites — генерирует код приглашения (только для владельцев)
  r.post("/lists/:id/invites", { schema: { params: ListParamsSchema } }, async (req, reply) => {
    if (!isOwner(app.db, req.params.id, req.accountId)) {
      return reply.code(404).send({ error: "not_found" });
    }
    const code = newCode(8);
    app.db
      .prepare("INSERT INTO list_invites (code, list_id, expires_at) VALUES (?, ?, ?)")
      .run(code, req.params.id, Date.now() + INVITE_TTL);
    return { code };
  });

  // POST /lists/join — присоединяется к списку по коду приглашения
  r.post("/lists/join", { schema: { body: CodeBodySchema } }, async (req, reply) => {
    const inv = app.db
      .prepare("SELECT list_id, expires_at FROM list_invites WHERE code = ?")
      .get(req.body.code) as { list_id: string; expires_at: number } | undefined;
    if (!inv || inv.expires_at < Date.now()) {
      return reply.code(400).send({ error: "invalid_code" });
    }
    app.db
      .prepare(
        "INSERT OR IGNORE INTO list_members (list_id, account_id, role) VALUES (?, ?, 'member')",
      )
      .run(inv.list_id, req.accountId);
    return rowToList(app.db.prepare("SELECT * FROM lists WHERE id = ?").get(inv.list_id));
  });
}
