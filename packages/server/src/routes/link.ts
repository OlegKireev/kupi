import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CodeBodySchema } from "@kupi/shared";
import { newCode, newId, newToken } from "@/ids";
import { setAuthCookie } from "@/auth";
import { buildBootstrap } from "@/bootstrap";

const LINK_TTL = 10 * 60 * 1000;

/**
 * Регистрирует роуты для связывания устройств.
 *
 * POST /link-codes (protected) — генерирует одноразовый код для связывания.
 * POST /link (public) — валидирует код, создаёт новое устройство, выдаёт cookie.
 */
export function linkRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * POST /link-codes (protected, требует auth)
   * Генерирует 6-значный код с TTL 10 минут.
   * Возвращает { code: "ABC123" }
   */
  r.post("/link-codes", async (req) => {
    const code = newCode(6);
    const expiresAt = Date.now() + LINK_TTL;
    app.db
      .prepare("INSERT INTO link_codes (code, account_id, expires_at) VALUES (?, ?, ?)")
      .run(code, req.accountId, expiresAt);
    return { code };
  });

  /**
   * POST /link (public, БЕЗ auth)
   * Валидирует код через CodeBodySchema, погашает его (DELETE), создаёт новое устройство,
   * выдаёт ему cookie, возвращает общий bootstrap для аккаунта.
   * Ошибки: 400 если код невалидный, истёк или уже использован.
   */
  r.post("/link", { schema: { body: CodeBodySchema } }, async (req, reply) => {
    const { code } = req.body;

    // Резолвим код
    const row = app.db
      .prepare("SELECT account_id, expires_at FROM link_codes WHERE code = ?")
      .get(code) as { account_id: string; expires_at: number } | undefined;

    // Проверяем существование и TTL
    if (!row || row.expires_at < Date.now()) {
      return reply.code(400).send({ error: "invalid_code" });
    }

    // Транзакция: создаём устройство и удаляем код (одноразовый)
    const token = newToken();
    const deviceId = newId();

    app.db.transaction(() => {
      app.db
        .prepare("INSERT INTO devices (id, account_id, token, created_at) VALUES (?, ?, ?, ?)")
        .run(deviceId, row.account_id, token, Date.now());
      app.db.prepare("DELETE FROM link_codes WHERE code = ?").run(code);
    })();

    // Выдаём cookie новому устройству
    setAuthCookie(reply, token);

    // Возвращаем bootstrap (аккаунт, списки, категории)
    return buildBootstrap(app.db, row.account_id);
  });
}
