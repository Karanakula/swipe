import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.SWIPE_DB_PATH ?? path.join(__dirname, "..", "data", "swipe.sqlite");

export function runInTransaction(db: DatabaseSync, fn: () => void) {
  db.exec("BEGIN IMMEDIATE");
  try {
    fn();
    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw err;
  }
}

export function openDb() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS votes (
      session_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      choice TEXT NOT NULL CHECK(choice IN ('yes','no')),
      voted_at INTEGER NOT NULL,
      decision_ms INTEGER,
      PRIMARY KEY (session_id, item_id),
      FOREIGN KEY (item_id) REFERENCES items(id)
    );

    CREATE INDEX IF NOT EXISTS idx_votes_item ON votes(item_id);

    CREATE TABLE IF NOT EXISTS sessions_meta (
      session_id TEXT PRIMARY KEY,
      first_seen_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );
  `);
  return db;
}

export type Db = ReturnType<typeof openDb>;
