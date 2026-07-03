import type Database from 'better-sqlite3';

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
 * Засеивает пресетные категории со стабильными id (идемпотентно, INSERT OR
 * IGNORE). Таблицы создаются отдельно, через db/migrator.ts — категории не
 * часть схемы, поэтому живут вне миграций.
 */
export function seedCategories(sqlite: Database.Database): void {
  const insert = sqlite.prepare(
    'INSERT OR IGNORE INTO categories (id, name, color, icon, sort) VALUES (?, ?, ?, ?, ?)',
  );
  CATEGORIES.forEach((category, sort) => insert.run(...category, sort));
}
