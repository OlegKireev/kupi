import type { Db } from '@/db';

// DDL для всех таблиц: идемпотентная инициализация схемы БД
const DDL = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS link_codes (
  code TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_account_id TEXT NOT NULL REFERENCES accounts(id),
  seq INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS list_members (
  list_id TEXT NOT NULL REFERENCES lists(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  role TEXT NOT NULL,
  PRIMARY KEY (list_id, account_id)
);
CREATE TABLE IF NOT EXISTS list_invites (
  code TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id),
  name TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  category_id TEXT,
  checked INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS items_list_version ON items(list_id, version);
CREATE TABLE IF NOT EXISTS applied_ops (
  client_op_id TEXT PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS item_frequency (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  normalized_name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, normalized_name)
);
`;

// Пресетный общий набор категорий для MVP. Кастомные категории добавятся позднее.
const CATEGORIES: Array<[string, string, string, string]> = [
  ['veg', 'Овощи и фрукты', '#4CAF50', '🥦'],
  ['dairy', 'Молочное', '#FFE082', '🥛'],
  ['meat', 'Мясо и рыба', '#E57373', '🍖'],
  ['grocery', 'Бакалея', '#D7CCC8', '🌾'],
  ['drinks', 'Напитки', '#64B5F6', '🥤'],
  ['bread', 'Хлеб', '#FFB74D', '🍞'],
  ['frozen', 'Заморозка', '#B3E5FC', '🧊'],
  ['household', 'Бытовое', '#B0BEC5', '🧽'],
  ['other', 'Другое', '#E0E0E0', '📦'],
];

/**
 * Инициализирует схему БД: создаёт таблицы (идемпотентно) и засеивает категории.
 * Можно вызывать несколько раз без ошибок (INSERT OR IGNORE).
 */
export function initSchema(db: Db): void {
  db.pragma('foreign_keys = ON');
  db.exec(DDL);

  // Засеиваем пресетные категории со стабильными id
  const insert = db.prepare(
    'INSERT OR IGNORE INTO categories (id, name, color, icon, sort) VALUES (?, ?, ?, ?, ?)',
  );
  CATEGORIES.forEach((c, i) => insert.run(c[0], c[1], c[2], c[3], i));

  db.pragma('user_version = 1');
}
