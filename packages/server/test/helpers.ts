import Database from "better-sqlite3";
import type { FastifyInstance } from "fastify";
import { buildApp } from "@/app";
import { COOKIE } from "@/auth";
import type { Bootstrap } from "@kupi/shared";

/**
 * Создаёт новый Fastify app с in-memory БД.
 * Удобно для тестов — каждый тест получает изолированное состояние.
 */
export function makeApp(): FastifyInstance {
  return buildApp(new Database(":memory:"));
}

/**
 * Регистрирует нового анонимного пользователя (POST /accounts)
 * и возвращает cookie-строку и bootstrap-данные.
 * Удобен для подготовки авторизованного состояния в тестах.
 */
export async function signup(
  app: FastifyInstance,
): Promise<{ cookie: string; bootstrap: Bootstrap }> {
  const res = await app.inject({ method: "POST", url: "/accounts" });
  const c = res.cookies.find((x) => x.name === COOKIE)!;
  return { cookie: `${COOKIE}=${c.value}`, bootstrap: res.json() as Bootstrap };
}
