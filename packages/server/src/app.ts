import Fastify, { type FastifyInstance } from "fastify";
import type { Db } from "./db.ts";

export function buildApp(db: Db): FastifyInstance {
  const app = Fastify({ logger: false });

  // db прокидывается уже сейчас, чтобы роуты фич из плана бэка могли им пользоваться
  app.decorate("db", db);

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
