/**
 * SQLite database (data/prepy.db) using Node's built-in `node:sqlite`:
 * no native build tools to install on Windows. Every user-owned row carries a user_id.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const DATA_DIR = process.env.PREPY_DATA_DIR || path.join(process.cwd(), "data");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  image TEXT,
  password_hash TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  raw_text TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jds_user ON jds(user_id);
CREATE TABLE IF NOT EXISTS fit_maps (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jd_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, jd_id)
);
CREATE TABLE IF NOT EXISTS kits (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jd_id TEXT NOT NULL,
  key TEXT NOT NULL,
  data TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, jd_id, key)
);
CREATE TABLE IF NOT EXISTS plans (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jd_id TEXT NOT NULL,
  done TEXT NOT NULL,
  PRIMARY KEY (user_id, jd_id)
);
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jd_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  input_mode TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_user_jd ON attempts(user_id, jd_id);
CREATE TABLE IF NOT EXISTS llm_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  prompt_name TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// One connection per server process (kept on globalThis so dev hot reloads reuse it).
const g = globalThis as unknown as { prepyDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.prepyDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const conn = new DatabaseSync(path.join(DATA_DIR, "prepy.db"));
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    conn.exec(SCHEMA);
    g.prepyDb = conn;
  }
  return g.prepyDb;
}

/** Run several writes as one transaction. */
export function transaction<T>(fn: () => T): T {
  const conn = db();
  conn.exec("BEGIN");
  try {
    const out = fn();
    conn.exec("COMMIT");
    return out;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}
