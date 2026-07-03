import type { Migration } from 'kysely/migration';

import * as m001Init from '@/db/migrations/001-init';

// Каждое будущее изменение схемы — новый файл 00N-описание.ts с up()
// (и, при необходимости, down()), добавленный сюда под своим именем.
// migrateToLatest применяет только то, чего ещё нет в kysely_migration —
// так апдейт схемы на уже заполненной БД не требует стирать файл БД руками.
export const migrations: Record<string, Migration> = {
  '001-init': m001Init,
};
