/**
 * User accounts: email/password (scrypt hashes, Node built-in) and Google sign-in.
 * The first account created also takes over the single-user data from the MVP
 * (data/prepy.json), so nothing saved before sign-in existed is lost.
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { db, transaction, DATA_DIR } from "./db";

export type UserRow = { id: string; email: string; name: string; image: string | null; password_hash: string | null };

const now = () => new Date().toISOString();
const normEmail = (e: string) => e.trim().toLowerCase();

export function findUserByEmail(email: string): UserRow | null {
  return (db().prepare("SELECT * FROM users WHERE email = ?").get(normEmail(email)) as UserRow | undefined) ?? null;
}

export function findUserById(id: string): UserRow | null {
  return (db().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined) ?? null;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  const [scheme, saltHex, hashHex] = (stored ?? "").split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export class SignUpError extends Error {}

function insertUser(u: { email: string; name: string; image?: string | null; password_hash?: string | null }): UserRow {
  const row: UserRow = {
    id: randomUUID(),
    email: normEmail(u.email),
    name: u.name.trim(),
    image: u.image ?? null,
    password_hash: u.password_hash ?? null,
  };
  db()
    .prepare("INSERT INTO users (id, email, name, image, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(row.id, row.email, row.name, row.image, row.password_hash, now());
  claimLegacyData(row.id);
  return row;
}

/** Email/password sign-up. */
export function createPasswordUser(input: { email: string; password: string; name: string }): UserRow {
  const email = normEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SignUpError("Enter a valid email address.");
  if (input.password.length < 8) throw new SignUpError("Use a password of at least 8 characters.");
  const existing = findUserByEmail(email);
  if (existing) {
    throw new SignUpError(
      existing.password_hash
        ? "An account with this email already exists. Sign in instead."
        : "This email signs in with Google. Use “Continue with Google”.",
    );
  }
  return insertUser({ email, name: input.name || email.split("@")[0], password_hash: hashPassword(input.password) });
}

/** Google sign-in: find the account by email, or create it. */
export function upsertGoogleUser(input: { email: string; name?: string | null; image?: string | null }): UserRow {
  const existing = findUserByEmail(input.email);
  if (existing) {
    db()
      .prepare("UPDATE users SET name = CASE WHEN name = '' THEN ? ELSE name END, image = COALESCE(?, image) WHERE id = ?")
      .run(input.name ?? "", input.image ?? null, existing.id);
    return findUserById(existing.id)!;
  }
  return insertUser({ email: input.email, name: input.name ?? "", image: input.image });
}

/* ---------- One-time move of the MVP's JSON data into the first account ---------- */

type LegacyDB = {
  profile?: { raw_text: string; data: unknown; updated_at: string } | null;
  jds?: Record<string, { id: string; company: string; role: string; raw_text: string; data: unknown; created_at: string }>;
  fitMaps?: Record<string, { created_at?: string } & Record<string, unknown>>;
  kits?: Record<string, Record<string, { data: unknown; prompt_version: string; created_at: string }>>;
  plans?: Record<string, string[]>;
  attempts?: {
    id: string;
    jd_id: string;
    item_id: string;
    item_type: string;
    input_mode: string;
    answer_text: string;
    result: unknown;
    created_at: string;
  }[];
};

function claimLegacyData(userId: string) {
  const file = path.join(DATA_DIR, "prepy.json");
  const claimed = db().prepare("SELECT value FROM meta WHERE key = 'legacy_claimed'").get();
  if (claimed || !fs.existsSync(file)) return;
  let legacy: LegacyDB;
  try {
    legacy = JSON.parse(fs.readFileSync(file, "utf8")) as LegacyDB;
  } catch (err) {
    console.warn(`[users] could not read ${file}: ${err}`);
    return;
  }
  const s = (v: unknown) => JSON.stringify(v);
  transaction(() => {
    const d = db();
    if (legacy.profile) {
      d.prepare("INSERT INTO profiles (user_id, raw_text, data, updated_at) VALUES (?, ?, ?, ?)").run(
        userId,
        legacy.profile.raw_text ?? "",
        s(legacy.profile.data),
        legacy.profile.updated_at ?? now(),
      );
    }
    for (const j of Object.values(legacy.jds ?? {})) {
      d.prepare("INSERT INTO jds (id, user_id, company, role, raw_text, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        j.id,
        userId,
        j.company ?? "",
        j.role ?? "",
        j.raw_text ?? "",
        s(j.data),
        j.created_at ?? now(),
      );
    }
    for (const [jdId, f] of Object.entries(legacy.fitMaps ?? {})) {
      const { created_at, ...fit } = f;
      d.prepare("INSERT INTO fit_maps (user_id, jd_id, data, created_at) VALUES (?, ?, ?, ?)").run(userId, jdId, s(fit), created_at ?? now());
    }
    for (const [jdId, keys] of Object.entries(legacy.kits ?? {})) {
      for (const [key, k] of Object.entries(keys)) {
        d.prepare("INSERT INTO kits (user_id, jd_id, key, data, prompt_version, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
          userId,
          jdId,
          key,
          s(k.data),
          k.prompt_version ?? "v1",
          k.created_at ?? now(),
        );
      }
    }
    for (const [jdId, done] of Object.entries(legacy.plans ?? {})) {
      d.prepare("INSERT INTO plans (user_id, jd_id, done) VALUES (?, ?, ?)").run(userId, jdId, s(done));
    }
    for (const a of legacy.attempts ?? []) {
      d.prepare(
        `INSERT INTO attempts (id, user_id, jd_id, item_id, item_type, input_mode, answer_text, result, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(a.id, userId, a.jd_id, a.item_id, a.item_type, a.input_mode, a.answer_text, s(a.result), a.created_at);
    }
    d.prepare("INSERT INTO meta (key, value) VALUES ('legacy_claimed', ?)").run(userId);
  });
  // Keep the old file as a backup, renamed so it is not imported again.
  fs.renameSync(file, file + ".migrated");
  console.info(`[users] moved data/prepy.json into the first account (${userId}).`);
}
