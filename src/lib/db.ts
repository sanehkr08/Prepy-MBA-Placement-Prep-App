/**
 * SQLite database through the libSQL client (`@libsql/client`):
 * - locally, the file data/prepy.db (no native build tools needed on Windows);
 * - when TURSO_DATABASE_URL is set (the hosted demo), a Turso database.
 * Every user-owned row carries a user_id. All access is async.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client, type InValue } from "@libsql/client";

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
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'jd'
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
CREATE TABLE IF NOT EXISTS mocks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jd_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS mocks_user_jd ON mocks(user_id, jd_id);
CREATE TABLE IF NOT EXISTS speeches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS speeches_user ON speeches(user_id);
CREATE TABLE IF NOT EXISTS gds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS gds_user ON gds(user_id);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/** Add columns that newer versions need to databases created by older ones. */
async function migrate(conn: Client) {
  const cols = (await conn.execute("PRAGMA table_info(jds)")).rows.map((c) => String(c.name));
  // 'jd' = a job description the user added; 'role' = "Prepare for a role" (a standard role profile).
  if (!cols.includes("kind")) await conn.execute("ALTER TABLE jds ADD COLUMN kind TEXT NOT NULL DEFAULT 'jd'");
}

// Bump when SCHEMA or migrate() changes, so a running server applies it without a restart.
const SCHEMA_VERSION = 6;

// One client per server process (kept on globalThis so dev hot reloads reuse it).
const g = globalThis as unknown as { prepyDb?: Client; prepySchema?: { version: number; ready: Promise<void> } };

export const usingTurso = () => !!process.env.TURSO_DATABASE_URL;

function connect(): Client {
  if (usingTurso()) {
    return createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return createClient({ url: pathToFileURL(path.join(DATA_DIR, "prepy.db")).href });
}

async function client(): Promise<Client> {
  g.prepyDb ??= connect();
  const conn = g.prepyDb;
  // A hot reload keeps the old client, so schema changes are applied here, not only on connect.
  if (g.prepySchema?.version !== SCHEMA_VERSION) {
    const ready = (async () => {
      await conn.executeMultiple(SCHEMA);
      await migrate(conn);
    })();
    g.prepySchema = { version: SCHEMA_VERSION, ready };
    // Retry on the next call if setting up failed (e.g. the network blipped).
    ready.catch(() => {
      if (g.prepySchema?.ready === ready) g.prepySchema = undefined;
    });
  }
  await g.prepySchema!.ready;
  return conn;
}

export type Row = Record<string, unknown>;
export type Stmt = { sql: string; args?: InValue[] };

/** All rows of a query. */
export async function all(sql: string, args: InValue[] = []): Promise<Row[]> {
  return (await (await client()).execute({ sql, args })).rows as unknown as Row[];
}

/** The first row of a query, or undefined. */
export async function get(sql: string, args: InValue[] = []): Promise<Row | undefined> {
  return (await all(sql, args))[0];
}

/** Run a write; returns the number of rows changed. */
export async function run(sql: string, args: InValue[] = []): Promise<number> {
  return (await (await client()).execute({ sql, args })).rowsAffected;
}

/** Run several writes as one transaction; returns rows changed per statement. */
export async function batch(stmts: Stmt[]): Promise<number[]> {
  if (!stmts.length) return [];
  const out = await (await client()).batch(
    stmts.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    "write",
  );
  return out.map((r) => r.rowsAffected);
}
