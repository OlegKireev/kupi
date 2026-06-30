import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { Db } from "@/db";
import { initSchema } from "@/schema";
import { registerAuth } from "@/auth";
import { accountRoutes } from "@/routes/accounts";

export function buildApp(db: Db): FastifyInstance {
  const app = Fastify({ logger: false });

  // Инициализируем схему БД (идемпотентно): создаём таблицы и засеиваем категории
  initSchema(db);

  // db прокидывается уже сейчас, чтобы роуты фич из плана бэка могли им пользоваться
  app.decorate("db", db);

  // Устанавливаем zod-компиляторы для валидации и сериализации
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Регистрируем cookie-аутентификацию со sliding renewal
  registerAuth(app);

  // Регистрируем роуты для аккаунтов
  accountRoutes(app);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}
