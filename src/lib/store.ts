/**
 * Data store for the signed-in user, backed by SQLite through libSQL (src/lib/db.ts). All methods are async.
 * Every call works on the user set by `runAsUser` (src/lib/user-context.ts), so
 * routes and orchestration code never see another user's rows.
 */
import { randomUUID } from "node:crypto";
import { all, batch, get, run, type Row } from "./db";
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

const now = () => new Date().toISOString();
const json = <T>(s: unknown): T => JSON.parse(String(s)) as T;
const uid = () => currentUserId();
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function jdFromRow(r: Row): JDRecord {
  return {
    id: str(r.id),
    kind: r.kind === "role" ? "role" : "jd",
    company: str(r.company),
    role: str(r.role),
    raw_text: str(r.raw_text),
    data: json<JDData>(r.data),
    created_at: str(r.created_at),
  };
}

const mockFromRow = (r: Row): MockRecord => ({
  id: str(r.id),
  jd_id: str(r.jd_id),
  data: json<MockData>(r.data),
  created_at: str(r.created_at),
  finished_at: r.finished_at ? str(r.finished_at) : null,
});

const gdFromRow = (r: Row): GDRecord => ({
  id: str(r.id),
  data: json<GDData>(r.data),
  created_at: str(r.created_at),
  finished_at: r.finished_at ? str(r.finished_at) : null,
});

export const store = {
  /* profile */
  getProfile: async () => {
    const r = await get("SELECT raw_text, data, updated_at FROM profiles WHERE user_id = ?", [uid()]);
    return r ? { raw_text: str(r.raw_text), data: json<Profile>(r.data), updated_at: str(r.updated_at) } : null;
  },
  saveProfile: async (data: Profile, raw_text?: string) => {
    const prev = await store.getProfile();
    const rec = { raw_text: raw_text ?? prev?.raw_text ?? "", data, updated_at: now() };
    await run(
      `INSERT INTO profiles (user_id, raw_text, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET raw_text = excluded.raw_text, data = excluded.data, updated_at = excluded.updated_at`,
      [uid(), rec.raw_text, JSON.stringify(data), rec.updated_at],
    );
    return rec;
  },

  /* job descriptions */
  createJD: async (input: Omit<JDRecord, "id" | "created_at" | "kind"> & { kind?: JDKind }) => {
    const rec: JDRecord = { ...input, kind: input.kind ?? "jd", id: randomUUID().slice(0, 8), created_at: now() };
    await run("INSERT INTO jds (id, user_id, company, role, raw_text, data, created_at, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
      rec.id,
      uid(),
      rec.company,
      rec.role,
      rec.raw_text,
      JSON.stringify(rec.data),
      rec.created_at,
      rec.kind,
    ]);
    return rec;
  },
  /** The user's saved "Prepare for a role" kit for this role name, if any. */
  findRoleJD: async (roleName: string) => {
    const r = await get(
      "SELECT * FROM jds WHERE user_id = ? AND kind = 'role' AND lower(role) = lower(?) ORDER BY created_at DESC LIMIT 1",
      [uid(), roleName.trim()],
    );
    return r ? jdFromRow(r) : null;
  },
  getJD: async (id: string) => {
    const r = await get("SELECT * FROM jds WHERE id = ? AND user_id = ?", [id, uid()]);
    return r ? jdFromRow(r) : null;
  },
  listJDs: async () => {
    const rows = await all(
      `SELECT j.id, j.kind, j.company, j.role, j.created_at, f.data AS fit
       FROM jds j LEFT JOIN fit_maps f ON f.user_id = j.user_id AND f.jd_id = j.id
       WHERE j.user_id = ? ORDER BY j.created_at DESC`,
      [uid()],
    );
    return rows.map((r) => ({
      id: str(r.id),
      kind: (r.kind === "role" ? "role" : "jd") as JDKind,
      company: str(r.company),
      role: str(r.role),
      created_at: str(r.created_at),
      overall_label: r.fit ? (json<FitMap>(r.fit).overall_label ?? null) : null,
    }));
  },

  /** Delete one JD and everything built from it (fit map, kit, plan, practice, mocks). False if not found. */
  deleteJD: async (id: string): Promise<boolean> => {
    const user = uid();
    const [gone] = await batch([
      { sql: "DELETE FROM jds WHERE id = ? AND user_id = ?", args: [id, user] },
      ...["fit_maps", "kits", "plans", "attempts", "mocks"].map((t) => ({
        sql: `DELETE FROM ${t} WHERE user_id = ? AND jd_id = ?`,
        args: [user, id],
      })),
    ]);
    return gone > 0;
  },

  /* fit maps */
  getFitMap: async (jdId: string) => {
    const r = await get("SELECT data, created_at FROM fit_maps WHERE user_id = ? AND jd_id = ?", [uid(), jdId]);
    return r ? { ...json<FitMap>(r.data), created_at: str(r.created_at) } : null;
  },
  saveFitMap: async (jdId: string, fit: FitMap) => {
    const created_at = now();
    await run(
      `INSERT INTO fit_maps (user_id, jd_id, data, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, jd_id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at`,
      [uid(), jdId, JSON.stringify(fit), created_at],
    );
    return { ...fit, created_at };
  },

  /* kit sections, answer outlines, notes and other cached generations */
  getKit: async (jdId: string, key: string): Promise<KitRecord | null> => {
    const r = await get("SELECT data, prompt_version, created_at FROM kits WHERE user_id = ? AND jd_id = ? AND key = ?", [uid(), jdId, key]);
    return r ? { data: json(r.data), prompt_version: str(r.prompt_version), created_at: str(r.created_at) } : null;
  },
  saveKit: async (jdId: string, key: string, data: unknown, prompt_version: string): Promise<KitRecord> => {
    const rec = { data, prompt_version, created_at: now() };
    await run(
      `INSERT INTO kits (user_id, jd_id, key, data, prompt_version, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, jd_id, key) DO UPDATE SET data = excluded.data,
         prompt_version = excluded.prompt_version, created_at = excluded.created_at`,
      [uid(), jdId, key, JSON.stringify(data), prompt_version, rec.created_at],
    );
    return rec;
  },

  /* study plan */
  getPlanDone: async (jdId: string): Promise<string[]> => {
    const r = await get("SELECT done FROM plans WHERE user_id = ? AND jd_id = ?", [uid(), jdId]);
    return r ? json<string[]>(r.done) : [];
  },
  setPlanDone: async (jdId: string, done: string[]) => {
    await run(
      `INSERT INTO plans (user_id, jd_id, done) VALUES (?, ?, ?)
       ON CONFLICT(user_id, jd_id) DO UPDATE SET done = excluded.done`,
      [uid(), jdId, JSON.stringify(done)],
    );
    return done;
  },

  /* practice */
  addAttempt: async (a: Omit<AttemptRecord, "id" | "created_at">) => {
    const rec: AttemptRecord = { ...a, id: randomUUID().slice(0, 8), created_at: now() };
    await run(
      `INSERT INTO attempts (id, user_id, jd_id, item_id, item_type, input_mode, answer_text, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rec.id, uid(), rec.jd_id, rec.item_id, rec.item_type, rec.input_mode, rec.answer_text, JSON.stringify(rec.result), rec.created_at],
    );
    return rec;
  },
  listAttempts: async (jdId: string): Promise<AttemptRecord[]> =>
    (await all("SELECT * FROM attempts WHERE user_id = ? AND jd_id = ? ORDER BY created_at", [uid(), jdId])).map((r) => ({
      id: str(r.id),
      jd_id: str(r.jd_id),
      item_id: str(r.item_id),
      item_type: str(r.item_type),
      input_mode: r.input_mode === "voice" ? "voice" : "typed",
      answer_text: str(r.answer_text),
      result: json<PracticeScore>(r.result),
      created_at: str(r.created_at),
    })),

  /* mock interviews */
  createMock: async (jdId: string, data: MockData): Promise<MockRecord> => {
    const rec: MockRecord = { id: randomUUID().slice(0, 8), jd_id: jdId, data, created_at: now(), finished_at: null };
    await run("INSERT INTO mocks (id, user_id, jd_id, data, created_at) VALUES (?, ?, ?, ?, ?)", [
      rec.id,
      uid(),
      jdId,
      JSON.stringify(data),
      rec.created_at,
    ]);
    return rec;
  },
  getMock: async (id: string): Promise<MockRecord | null> => {
    const r = await get("SELECT * FROM mocks WHERE id = ? AND user_id = ?", [id, uid()]);
    return r ? mockFromRow(r) : null;
  },
  saveMock: async (id: string, data: MockData, finished = false) => {
    await run("UPDATE mocks SET data = ?, finished_at = CASE WHEN ? THEN ? ELSE finished_at END WHERE id = ? AND user_id = ?", [
      JSON.stringify(data),
      finished ? 1 : 0,
      now(),
      id,
      uid(),
    ]);
  },
  listMocks: async (jdId: string): Promise<MockRecord[]> =>
    (
      await all("SELECT * FROM mocks WHERE user_id = ? AND jd_id = ? AND finished_at IS NOT NULL ORDER BY created_at DESC", [uid(), jdId])
    ).map(mockFromRow),

  /** Every finished mock interview, newest first, with the kit it belongs to. */
  listAllMocks: async () =>
    (
      await all(
        `SELECT m.id, m.jd_id, m.data, m.created_at, j.role, j.company, j.kind
         FROM mocks m JOIN jds j ON j.id = m.jd_id AND j.user_id = m.user_id
         WHERE m.user_id = ? AND m.finished_at IS NOT NULL ORDER BY m.created_at DESC`,
        [uid()],
      )
    ).map((r) => ({
      id: str(r.id),
      jd_id: str(r.jd_id),
      data: json<MockData>(r.data),
      created_at: str(r.created_at),
      kit: { role: str(r.role), company: str(r.company), kind: (r.kind === "role" ? "role" : "jd") as JDKind },
    })),

  /* impromptu speeches */
  createSpeech: async (data: SpeechData): Promise<SpeechRecord> => {
    const rec = { id: randomUUID().slice(0, 8), data, created_at: now() };
    await run("INSERT INTO speeches (id, user_id, data, created_at) VALUES (?, ?, ?, ?)", [rec.id, uid(), JSON.stringify(data), rec.created_at]);
    return rec;
  },
  getSpeech: async (id: string): Promise<SpeechRecord | null> => {
    const r = await get("SELECT * FROM speeches WHERE id = ? AND user_id = ?", [id, uid()]);
    return r ? { id: str(r.id), data: json<SpeechData>(r.data), created_at: str(r.created_at) } : null;
  },
  listSpeeches: async (limit = 50): Promise<SpeechRecord[]> =>
    (await all("SELECT * FROM speeches WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", [uid(), limit])).map((r) => ({
      id: str(r.id),
      data: json<SpeechData>(r.data),
      created_at: str(r.created_at),
    })),

  /* group discussions */
  createGD: async (data: GDData): Promise<GDRecord> => {
    const rec: GDRecord = { id: randomUUID().slice(0, 8), data, created_at: now(), finished_at: null };
    await run("INSERT INTO gds (id, user_id, data, created_at) VALUES (?, ?, ?, ?)", [rec.id, uid(), JSON.stringify(data), rec.created_at]);
    return rec;
  },
  getGD: async (id: string): Promise<GDRecord | null> => {
    const r = await get("SELECT * FROM gds WHERE id = ? AND user_id = ?", [id, uid()]);
    return r ? gdFromRow(r) : null;
  },
  saveGD: async (id: string, data: GDData, finished = false) => {
    await run("UPDATE gds SET data = ?, finished_at = CASE WHEN ? THEN ? ELSE finished_at END WHERE id = ? AND user_id = ?", [
      JSON.stringify(data),
      finished ? 1 : 0,
      now(),
      id,
      uid(),
    ]);
  },
  listGDs: async (limit = 50): Promise<GDRecord[]> =>
    (await all("SELECT * FROM gds WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY created_at DESC LIMIT ?", [uid(), limit])).map(gdFromRow),
  /** Topics of recent group discussions, finished or not (to avoid repeats). */
  recentGDTopics: async (limit = 15): Promise<string[]> =>
    (await all("SELECT data FROM gds WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", [uid(), limit])).map(
      (r) => json<GDData>(r.data).topic,
    ),

  /* llm call log (also written by health checks, so the user is optional) */
  logLLMCall: async (c: Omit<LLMCallRecord, "created_at">) => {
    await run(
      `INSERT INTO llm_calls (user_id, prompt_name, prompt_version, input_tokens, output_tokens, latency_ms, ok, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [maybeUserId(), c.prompt_name, c.prompt_version, c.input_tokens, c.output_tokens, c.latency_ms, c.ok ? 1 : 0, now()],
    );
  },
  /** AI calls since a time: for one user, or for everyone (the demo's daily limits). */
  countLLMCalls: async (sinceIso: string, userId?: string): Promise<number> => {
    const r = userId
      ? await get("SELECT COUNT(*) AS n FROM llm_calls WHERE created_at >= ? AND user_id = ?", [sinceIso, userId])
      : await get("SELECT COUNT(*) AS n FROM llm_calls WHERE created_at >= ?", [sinceIso]);
    return Number(r?.n ?? 0);
  },

  /* delete everything this user has stored (the account itself stays) */
  deleteAll: async () => {
    const id = uid();
    await batch(
      ["profiles", "jds", "fit_maps", "kits", "plans", "attempts", "mocks", "speeches", "gds", "llm_calls"].map((t) => ({
        sql: `DELETE FROM ${t} WHERE user_id = ?`,
        args: [id],
      })),
    );
  },
};
