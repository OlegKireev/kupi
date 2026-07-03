import type Database from 'better-sqlite3';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { accountRoutes } from '@/accounts/routes';
import { registerAuth } from '@/auth/auth';
import { createDb, type Db } from '@/db/connection';
import { migrateToLatest } from '@/db/migrator';
import { purgeStaleData } from '@/db/purge';
import { seedCategories } from '@/db/schema';
import { linkRoutes } from '@/link/routes';
import { listRoutes } from '@/lists/routes';
import { syncRoutes } from '@/sync/routes';

export async function buildApp(
  sqlite: Database.Database,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Оборачиваем в typesafe Kysely query builder, прокидываем в роуты
  const db = createDb(sqlite);
  app.decorate('db', db);

  // Применяем ещё не применённые миграции (см. db/migrations/) и засеиваем
  // категории — идемпотентно, безопасно на каждом старте
  await migrateToLatest(db);
  seedCategories(sqlite);

  // Чистим монотонно растущие таблицы (applied_ops, старые tombstones) —
  // дёшево на пустой/маленькой БД, безопасно на каждом старте. Периодический
  // повтор для долгоживущего процесса — в index.ts.
  await purgeStaleData(db);

  // Устанавливаем zod-компиляторы для валидации и сериализации
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Регистрируем cookie-аутентификацию со sliding renewal
  registerAuth(app);

  // Все роуты живут под общим префиксом /api
  app.register(
    async (api) => {
      // Регистрируем роуты для аккаунтов
      accountRoutes(api);

      // Регистрируем роуты для связывания устройств
      linkRoutes(api);

      // Регистрируем роуты для списков покупок
      listRoutes(api);

      // Регистрируем роуты для синхронизации и подсказок
      syncRoutes(api);

      api.get('/health', async () => {
        return { status: 'ok' };
      });
    },
    { prefix: '/api' },
  );

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}
