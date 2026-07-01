import type Database from 'better-sqlite3';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { accountRoutes } from '@/accounts/routes';
import { registerAuth } from '@/auth/auth';
import { createDb, type Db } from '@/db/connection';
import { initSchema } from '@/db/schema';
import { linkRoutes } from '@/link/routes';
import { listRoutes } from '@/lists/routes';
import { syncRoutes } from '@/sync/routes';

export function buildApp(sqlite: Database.Database): FastifyInstance {
  const app = Fastify({ logger: false });

  // Инициализируем схему БД (идемпотентно): создаём таблицы и засеиваем категории
  initSchema(sqlite);

  // Оборачиваем в typesafe Kysely query builder, прокидываем в роуты
  app.decorate('db', createDb(sqlite));

  // Устанавливаем zod-компиляторы для валидации и сериализации
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Регистрируем cookie-аутентификацию со sliding renewal
  registerAuth(app);

  // Регистрируем роуты для аккаунтов
  accountRoutes(app);

  // Регистрируем роуты для связывания устройств
  linkRoutes(app);

  // Регистрируем роуты для списков покупок
  listRoutes(app);

  // Регистрируем роуты для синхронизации и подсказок
  syncRoutes(app);

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}
