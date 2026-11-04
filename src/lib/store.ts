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

/** One mock interview: its questions, the answers given, and the scorecard once finished. */
export type MockQuestion = {
  item_id: string;
  type: string;
  label: string;
  text: string;
  followup_eligible: boolean;
  answer: string;
  followup: string; // the interviewer's follow-up question ("" if none)
  followup_answer: string;
  input_mode: "typed" | "voice";
};
export type MockData = {
  length: number;
  seconds_per_question: number;
  questions: MockQuestion[];
  result: unknown | null; // MockScore when finished
};
export type MockRecord = { id: string; jd_id: string; data: MockData; created_at: string; finished_at: string | null };

/** One impromptu speech: the topic, what was said, and its feedback. */
export type SpeechData = {
  topic: string;
  category: string;
  prep_seconds: number;
  speak_seconds: number;
  duration_seconds: number;
  transcript: string;
  input_mode: "typed" | "voice";
  stats: { words: number; wpm: number; fillers: Record<string, number>; filler_total: number };
  result: unknown;
};
export type SpeechRecord = { id: string; data: SpeechData; created_at: string };

/** One group discussion: the topic, the AI members, every turn, and the feedback once finished. */
export type GDTurn = { speaker: string; text: string; round: number; kind: "point" | "open" | "summary" | "pass" };
export type GDData = {
  mode: "quick" | "full";
  topic: string;
  context: string;
  members: { name: string; style: string }[];
  turns: GDTurn[];
  rounds_done: number; // AI rounds so far (full mode)
  input_mode: "typed" | "voice";
  result: unknown | null;
};
export type GDRecord = { id: string; data: GDData; created_at: string; finished_at: string | null };

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
        for (const t of ["fit_maps", "kits", "plans", "attempts", "mocks"]) {
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

  /* mock interviews */
  createMock: (jdId: string, data: MockData): MockRecord => {
    const rec: MockRecord = { id: randomUUID().slice(0, 8), jd_id: jdId, data, created_at: now(), finished_at: null };
    db()
      .prepare("INSERT INTO mocks (id, user_id, jd_id, data, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(rec.id, uid(), jdId, JSON.stringify(data), rec.created_at);
    return rec;
  },
  getMock: (id: string): MockRecord | null => {
    const r = db().prepare("SELECT * FROM mocks WHERE id = ? AND user_id = ?").get(id, uid()) as Row | undefined;
    return r
      ? {
          id: String(r.id),
          jd_id: String(r.jd_id),
          data: json<MockData>(r.data),
          created_at: String(r.created_at),
          finished_at: r.finished_at ? String(r.finished_at) : null,
        }
      : null;
  },
  saveMock: (id: string, data: MockData, finished = false) => {
    db()
      .prepare("UPDATE mocks SET data = ?, finished_at = CASE WHEN ? THEN ? ELSE finished_at END WHERE id = ? AND user_id = ?")
      .run(JSON.stringify(data), finished ? 1 : 0, now(), id, uid());
  },
  listMocks: (jdId: string): MockRecord[] =>
    (
      db()
        .prepare("SELECT * FROM mocks WHERE user_id = ? AND jd_id = ? AND finished_at IS NOT NULL ORDER BY created_at DESC")
        .all(uid(), jdId) as Row[]
    ).map((r) => ({
      id: String(r.id),
      jd_id: String(r.jd_id),
      data: json<MockData>(r.data),
      created_at: String(r.created_at),
      finished_at: r.finished_at ? String(r.finished_at) : null,
    })),

  /** Every finished mock interview, newest first, with the kit it belongs to. */
  listAllMocks: () =>
    (
      db()
        .prepare(
          `SELECT m.id, m.jd_id, m.data, m.created_at, j.role, j.company, j.kind
           FROM mocks m JOIN jds j ON j.id = m.jd_id AND j.user_id = m.user_id
           WHERE m.user_id = ? AND m.finished_at IS NOT NULL ORDER BY m.created_at DESC`,
        )
        .all(uid()) as Row[]
    ).map((r) => ({
      id: String(r.id),
      jd_id: String(r.jd_id),
      data: json<MockData>(r.data),
      created_at: String(r.created_at),
      kit: { role: String(r.role), company: String(r.company), kind: (r.kind === "role" ? "role" : "jd") as JDKind },
    })),

  /* impromptu speeches */
  createSpeech: (data: SpeechData): SpeechRecord => {
    const rec = { id: randomUUID().slice(0, 8), data, created_at: now() };
    db().prepare("INSERT INTO speeches (id, user_id, data, created_at) VALUES (?, ?, ?, ?)").run(rec.id, uid(), JSON.stringify(data), rec.created_at);
    return rec;
  },
  getSpeech: (id: string): SpeechRecord | null => {
    const r = db().prepare("SELECT * FROM speeches WHERE id = ? AND user_id = ?").get(id, uid()) as Row | undefined;
    return r ? { id: String(r.id), data: json<SpeechData>(r.data), created_at: String(r.created_at) } : null;
  },
  listSpeeches: (limit = 50): SpeechRecord[] =>
    (db().prepare("SELECT * FROM speeches WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(uid(), limit) as Row[]).map((r) => ({
      id: String(r.id),
      data: json<SpeechData>(r.data),
      created_at: String(r.created_at),
    })),

  /* group discussions */
  createGD: (data: GDData): GDRecord => {
    const rec: GDRecord = { id: randomUUID().slice(0, 8), data, created_at: now(), finished_at: null };
    db().prepare("INSERT INTO gds (id, user_id, data, created_at) VALUES (?, ?, ?, ?)").run(rec.id, uid(), JSON.stringify(data), rec.created_at);
    return rec;
  },
  getGD: (id: string): GDRecord | null => {
    const r = db().prepare("SELECT * FROM gds WHERE id = ? AND user_id = ?").get(id, uid()) as Row | undefined;
    return r
      ? { id: String(r.id), data: json<GDData>(r.data), created_at: String(r.created_at), finished_at: r.finished_at ? String(r.finished_at) : null }
      : null;
  },
  saveGD: (id: string, data: GDData, finished = false) => {
    db()
      .prepare("UPDATE gds SET data = ?, finished_at = CASE WHEN ? THEN ? ELSE finished_at END WHERE id = ? AND user_id = ?")
      .run(JSON.stringify(data), finished ? 1 : 0, now(), id, uid());
  },
  listGDs: (limit = 50): GDRecord[] =>
    (
      db()
        .prepare("SELECT * FROM gds WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY created_at DESC LIMIT ?")
        .all(uid(), limit) as Row[]
    ).map((r) => ({
      id: String(r.id),
      data: json<GDData>(r.data),
      created_at: String(r.created_at),
      finished_at: r.finished_at ? String(r.finished_at) : null,
    })),
  /** Topics of recent group discussions, finished or not (to avoid repeats). */
  recentGDTopics: (limit = 15): string[] =>
    (db().prepare("SELECT data FROM gds WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(uid(), limit) as Row[]).map(
      (r) => json<GDData>(r.data).topic,
    ),

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
      for (const t of ["profiles", "jds", "fit_maps", "kits", "plans", "attempts", "mocks", "speeches", "gds", "llm_calls"]) {
        db().prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(id);
      }
    });
  },
};
