import type { FastifyInstance } from "fastify";
import type { Bootstrap, Category } from "@kupi/shared";
import { newId, newToken } from "@/ids";
import { setAuthCookie } from "@/auth";
import { buildBootstrap } from "@/bootstrap";
import { rowToCategory } from "@/map";

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
  app.post("/accounts", async (_req, reply): Promise<Bootstrap> => {
    const now = Date.now();
    const accountId = newId();
    const token = newToken();
    const deviceId = newId();
    const listId = newId();

    // Вся логика в одной транзакции
    app.db.transaction(() => {
      // Создаём аккаунт
      app.db.prepare("INSERT INTO accounts (id, created_at) VALUES (?, ?)").run(accountId, now);

      // Создаём первое устройство с токеном
      app.db
        .prepare("INSERT INTO devices (id, account_id, token, created_at) VALUES (?, ?, ?, ?)")
        .run(deviceId, accountId, token, now);

      // Создаём дефолтный список "Мои покупки"
      app.db
        .prepare(
          "INSERT INTO lists (id, name, owner_account_id, seq, created_at) VALUES (?, ?, ?, 0, ?)",
        )
        .run(listId, "Мои покупки", accountId, now);

      // Добавляем аккаунт как owner в дефолтный список
      app.db
        .prepare("INSERT INTO list_members (list_id, account_id, role) VALUES (?, ?, 'owner')")
        .run(listId, accountId);
    })();

    // Ставим auth cookie
    setAuthCookie(reply, token);

    // Возвращаем 201 Created и bootstrap
    reply.code(201);
    return buildBootstrap(app.db, accountId);
  });

  // GET /categories: публичный пресет (требует аутентификацию, см. registerAuth)
  app.get("/categories", async (): Promise<Category[]> => {
    return (app.db.prepare("SELECT * FROM categories ORDER BY sort").all() as any[]).map(
      rowToCategory,
    );
  });
}
