import Database from "better-sqlite3";

export function openDb(path = "kupi.db") {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export type Db = ReturnType<typeof openDb>;
