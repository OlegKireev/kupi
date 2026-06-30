import type { Account, Category, Item, List } from "@kupi/shared";

/**
 * Маппит SQLite строку в доменный тип Account.
 * SQLite хранит snake_case, маппим в camelCase.
 */
export const rowToAccount = (r: any): Account => ({
  id: r.id,
  createdAt: r.created_at,
});

/**
 * Маппит SQLite строку в доменный тип List.
 */
export const rowToList = (r: any): List => ({
  id: r.id,
  name: r.name,
  ownerAccountId: r.owner_account_id,
  seq: r.seq,
  createdAt: r.created_at,
});

/**
 * Маппит SQLite строку в доменный тип Item.
 * Преобразует integers (0/1) в boolean для полей checked и deleted.
 */
export const rowToItem = (r: any): Item => ({
  id: r.id,
  listId: r.list_id,
  name: r.name,
  quantity: r.quantity,
  categoryId: r.category_id,
  checked: !!r.checked,
  version: r.version,
  deleted: !!r.deleted,
  updatedAt: r.updated_at,
});

/**
 * Маппит SQLite строку в доменный тип Category.
 */
export const rowToCategory = (r: any): Category => ({
  id: r.id,
  name: r.name,
  color: r.color,
  icon: r.icon,
});
