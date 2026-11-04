/**
 * Data store for the signed-in user, backed by SQLite (src/lib/db.ts).
 * Every call works on the user set by `runAsUser` (src/lib/user-context.ts), so
 * routes and orchestration code never see another user's rows.
 */
import { randomUUID } from "node:crypto";
import { db, transaction } from "./db";
import { currentUserId, maybeUserId } from "./user-context";
import type { Profile, JDData, FitMap, PracticeScore } from "./schemas";

export type JDKind = "jd" | "role";

export type JDRecord = {
  id: string;
  kind: JDKind;
  company: string;
  role: string;
  raw_text: string;
  data: JDData;
  created_at: string;
};

export type KitRecord = {
  data: unknown;
  prompt_version: string;
  created_at: string;
};

export type AttemptRecord = {
  id: string;
  jd_id: string;
  item_id: string;
  item_type: string;
  input_mode: "typed" | "voice";
  answer_text: string;
  result: PracticeScore;
  created_at: string;
};

export type LLMCallRecord = {
  prompt_name: string;
  prompt_version: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  ok: boolean;
  created_at: string;
};

type Row = Record<string, string | number | null>;

const now = () => new Date().toISOString();
const json = <T>(s: unknown): T => JSON.parse(String(s)) as T;
const uid = () => currentUserId();

function jdFromRow(r: Row): JDRecord {
  return {
    id: String(r.id),
    kind: r.kind === "role" ? "role" : "jd",
    company: String(r.company),
    role: String(r.role),
    raw_text: String(r.raw_text),
    data: json<JDData>(r.data),
    created_at: String(r.created_at),
  };
}

export const store = {
  /* profile */
  getProfile: () => {
    const r = db().prepare("SELECT raw_text, data, updated_at FROM profiles WHERE user_id = ?").get(uid()) as Row | undefined;
    return r ? { raw_text: String(r.raw_text), data: json<Profile>(r.data), updated_at: String(r.updated_at) } : null;
  },
  saveProfile: (data: Profile, raw_text?: string) => {
    const prev = store.getProfile();
    const rec = { raw_text: raw_text ?? prev?.raw_text ?? "", data, updated_at: now() };
    db()
      .prepare(
        `INSERT INTO profiles (user_id, raw_text, data, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET raw_text = excluded.raw_text, data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(uid(), rec.raw_text, JSON.stringify(data), rec.updated_at);
    return rec;
  },

  /* job descriptions */
  createJD: (input: Omit<JDRecord, "id" | "created_at" | "kind"> & { kind?: JDKind }) => {
    const rec: JDRecord = { ...input, kind: input.kind ?? "jd", id: randomUUID().slice(0, 8), created_at: now() };
    db()
      .prepare("INSERT INTO jds (id, user_id, company, role, raw_text, data, created_at, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(rec.id, uid(), rec.company, rec.role, rec.raw_text, JSON.stringify(rec.data), rec.created_at, rec.kind);
    return rec;
  },
  /** The user's saved "Prepare for a role" kit for this role name, if any. */
  findRoleJD: (roleName: string) => {
    const r = db()
      .prepare("SELECT * FROM jds WHERE user_id = ? AND kind = 'role' AND lower(role) = lower(?) ORDER BY created_at DESC LIMIT 1")
      .get(uid(), roleName.trim()) as Row | undefined;
    return r ? jdFromRow(r) : null;
  },
  getJD: (id: string) => {
    const r = db().prepare("SELECT * FROM jds WHERE id = ? AND user_id = ?").get(id, uid()) as Row | undefined;
    return r ? jdFromRow(r) : null;
  },
  listJDs: () => {
    const rows = db()
      .prepare(
        `SELECT j.id, j.kind, j.company, j.role, j.created_at, f.data AS fit
         FROM jds j LEFT JOIN fit_maps f ON f.user_id = j.user_id AND f.jd_id = j.id
         WHERE j.user_id = ? ORDER BY j.created_at DESC`,
      )
      .all(uid()) as Row[];
    return rows.map((r) => ({
      id: String(r.id),
      kind: (r.kind === "role" ? "role" : "jd") as JDKind,
      company: String(r.company),
      role: String(r.role),
      created_at: String(r.created_at),
      overall_label: r.fit ? (json<FitMap>(r.fit).overall_label ?? null) : null,
    }));
  },

  /** Delete one JD and everything built from it (fit map, kit, plan, practice). False if not found. */
  deleteJD: (id: string): boolean => {
    const user = uid();
    return transaction(() => {
      const gone = db().prepare("DELETE FROM jds WHERE id = ? AND user_id = ?").run(id, user).changes > 0;
      if (gone) {
        for (const t of ["fit_maps", "kits", "plans", "attempts"]) {
          db().prepare(`DELETE FROM ${t} WHERE user_id = ? AND jd_id = ?`).run(user, id);
        }
      }
      return gone;
    });
  },

  /* fit maps */
  getFitMap: (jdId: string) => {
    const r = db().prepare("SELECT data, created_at FROM fit_maps WHERE user_id = ? AND jd_id = ?").get(uid(), jdId) as
      | Row
      | undefined;
    return r ? { ...json<FitMap>(r.data), created_at: String(r.created_at) } : null;
  },
  saveFitMap: (jdId: string, fit: FitMap) => {
    const created_at = now();
    db()
      .prepare(
        `INSERT INTO fit_maps (user_id, jd_id, data, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, jd_id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at`,
      )
      .run(uid(), jdId, JSON.stringify(fit), created_at);
    return { ...fit, created_at };
  },

  /* kit sections, answer outlines, notes and other cached generations */
  getKit: (jdId: string, key: string): KitRecord | null => {
    const r = db()
      .prepare("SELECT data, prompt_version, created_at FROM kits WHERE user_id = ? AND jd_id = ? AND key = ?")
      .get(uid(), jdId, key) as Row | undefined;
    return r ? { data: json(r.data), prompt_version: String(r.prompt_version), created_at: String(r.created_at) } : null;
  },
  saveKit: (jdId: string, key: string, data: unknown, prompt_version: string): KitRecord => {
    const rec = { data, prompt_version, created_at: now() };
    db()
      .prepare(
        `INSERT INTO kits (user_id, jd_id, key, data, prompt_version, created_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, jd_id, key) DO UPDATE SET data = excluded.data,
           prompt_version = excluded.prompt_version, created_at = excluded.created_at`,
      )
      .run(uid(), jdId, key, JSON.stringify(data), prompt_version, rec.created_at);
    return rec;
  },

  /* study plan */
  getPlanDone: (jdId: string): string[] => {
    const r = db().prepare("SELECT done FROM plans WHERE user_id = ? AND jd_id = ?").get(uid(), jdId) as Row | undefined;
    return r ? json<string[]>(r.done) : [];
  },
  setPlanDone: (jdId: string, done: string[]) => {
    db()
      .prepare(
        `INSERT INTO plans (user_id, jd_id, done) VALUES (?, ?, ?)
         ON CONFLICT(user_id, jd_id) DO UPDATE SET done = excluded.done`,
      )
      .run(uid(), jdId, JSON.stringify(done));
    return done;
  },

  /* practice */
  addAttempt: (a: Omit<AttemptRecord, "id" | "created_at">) => {
    const rec: AttemptRecord = { ...a, id: randomUUID().slice(0, 8), created_at: now() };
    db()
      .prepare(
        `INSERT INTO attempts (id, user_id, jd_id, item_id, item_type, input_mode, answer_text, result, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(rec.id, uid(), rec.jd_id, rec.item_id, rec.item_type, rec.input_mode, rec.answer_text, JSON.stringify(rec.result), rec.created_at);
    return rec;
  },
  listAttempts: (jdId: string): AttemptRecord[] =>
    (
      db()
        .prepare("SELECT * FROM attempts WHERE user_id = ? AND jd_id = ? ORDER BY created_at")
        .all(uid(), jdId) as Row[]
    ).map((r) => ({
      id: String(r.id),
      jd_id: String(r.jd_id),
      item_id: String(r.item_id),
      item_type: String(r.item_type),
      input_mode: r.input_mode === "voice" ? "voice" : "typed",
      answer_text: String(r.answer_text),
      result: json<PracticeScore>(r.result),
      created_at: String(r.created_at),
    })),

  /* llm call log (also written by health checks, so the user is optional) */
  logLLMCall: (c: Omit<LLMCallRecord, "created_at">) => {
    db()
      .prepare(
        `INSERT INTO llm_calls (user_id, prompt_name, prompt_version, input_tokens, output_tokens, latency_ms, ok, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(maybeUserId(), c.prompt_name, c.prompt_version, c.input_tokens, c.output_tokens, c.latency_ms, c.ok ? 1 : 0, now());
  },

  /* delete everything this user has stored (the account itself stays) */
  deleteAll: () => {
    const id = uid();
    transaction(() => {
      for (const t of ["profiles", "jds", "fit_maps", "kits", "plans", "attempts", "llm_calls"]) {
        db().prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(id);
      }
    });
  },
};
