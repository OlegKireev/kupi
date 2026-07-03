import { type Kysely, sql } from 'kysely';

// Один statement на better-sqlite3 prepare-вызов: multi-statement строки
// (через sqlite.exec) тут не поддерживаются Kysely-драйвером.
//
// IF NOT EXISTS: любая существующая на диске dev-БД уже содержит эти
// таблицы (они создавались раньше через db/schema.ts напрямую, без
// kysely_migration) — без IF NOT EXISTS первый запуск миграции на такой БД
// падает на "table already exists". На пустой БД ведёт себя как обычный
// CREATE TABLE.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    token TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS link_codes (
    code TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    owner_account_id TEXT NOT NULL REFERENCES accounts(id),
    seq INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS list_members (
    list_id TEXT NOT NULL REFERENCES lists(id),
    account_id TEXT NOT NULL REFERENCES accounts(id),
    role TEXT NOT NULL,
    PRIMARY KEY (list_id, account_id)
  )`,
  `CREATE TABLE IF NOT EXISTS list_invites (
    code TEXT PRIMARY KEY NOT NULL,
    list_id TEXT NOT NULL REFERENCES lists(id),
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS items (
    id TEXT NOT NULL,
    list_id TEXT NOT NULL REFERENCES lists(id),
    name TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    category_id TEXT,
    checked INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (list_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS items_list_version ON items(list_id, version)`,
  `CREATE TABLE IF NOT EXISTS applied_ops (
    list_id TEXT NOT NULL REFERENCES lists(id),
    client_op_id TEXT NOT NULL,
    PRIMARY KEY (list_id, client_op_id)
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    sort INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS item_frequency (
    account_id TEXT NOT NULL REFERENCES accounts(id),
    normalized_name TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (account_id, normalized_name)
  )`,
];

export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of STATEMENTS) {
    await sql.raw(statement).execute(db);
  }
}
