/**
 * Local data store for a single user: one JSON file at data/prepy.json.
 * Chosen over SQLite so `npm install` needs no native build tools on Windows.
 * All reads and writes go through this file, so it can be swapped for a real
 * database later without touching the routes.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Profile, JDData, FitMap, PracticeScore } from "./schemas";

export type JDRecord = {
  id: string;
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

type DB = {
  profile: { raw_text: string; data: Profile; updated_at: string } | null;
  jds: Record<string, JDRecord>;
  fitMaps: Record<string, FitMap & { created_at: string }>;
  kits: Record<string, Record<string, KitRecord>>; // jdId -> section/key -> record
  plans: Record<string, string[]>; // jdId -> done plan item ids
  attempts: AttemptRecord[];
  llmCalls: LLMCallRecord[];
};

const DATA_DIR = process.env.PREPY_DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "prepy.json");

const empty = (): DB => ({
  profile: null,
  jds: {},
  fitMaps: {},
  kits: {},
  plans: {},
  attempts: [],
  llmCalls: [],
});

function read(): DB {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return { ...empty(), ...(JSON.parse(raw) as Partial<DB>) };
  } catch {
    return empty();
  }
}

function write(db: DB) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, DB_FILE);
}

function update<T>(fn: (db: DB) => T): T {
  const db = read();
  const out = fn(db);
  write(db);
  return out;
}

const now = () => new Date().toISOString();

export const store = {
  /* profile */
  getProfile: () => read().profile,
  saveProfile: (data: Profile, raw_text?: string) =>
    update((db) => {
      db.profile = { raw_text: raw_text ?? db.profile?.raw_text ?? "", data, updated_at: now() };
      return db.profile;
    }),

  /* job descriptions */
  createJD: (input: Omit<JDRecord, "id" | "created_at">) =>
    update((db) => {
      const rec: JDRecord = { ...input, id: randomUUID().slice(0, 8), created_at: now() };
      db.jds[rec.id] = rec;
      return rec;
    }),
  getJD: (id: string) => read().jds[id] ?? null,
  listJDs: () => {
    const db = read();
    return Object.values(db.jds)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((j) => ({
        id: j.id,
        company: j.company,
        role: j.role,
        created_at: j.created_at,
        overall_label: db.fitMaps[j.id]?.overall_label ?? null,
      }));
  },

  /* fit maps */
  getFitMap: (jdId: string) => read().fitMaps[jdId] ?? null,
  saveFitMap: (jdId: string, fit: FitMap) =>
    update((db) => {
      db.fitMaps[jdId] = { ...fit, created_at: now() };
      return db.fitMaps[jdId];
    }),

  /* kit sections and answer outlines */
  getKit: (jdId: string, key: string) => read().kits[jdId]?.[key] ?? null,
  saveKit: (jdId: string, key: string, data: unknown, prompt_version: string) =>
    update((db) => {
      db.kits[jdId] = db.kits[jdId] ?? {};
      db.kits[jdId][key] = { data, prompt_version, created_at: now() };
      return db.kits[jdId][key];
    }),

  /* study plan */
  getPlanDone: (jdId: string) => read().plans[jdId] ?? [],
  setPlanDone: (jdId: string, done: string[]) =>
    update((db) => {
      db.plans[jdId] = done;
      return done;
    }),

  /* practice */
  addAttempt: (a: Omit<AttemptRecord, "id" | "created_at">) =>
    update((db) => {
      const rec: AttemptRecord = { ...a, id: randomUUID().slice(0, 8), created_at: now() };
      db.attempts.push(rec);
      return rec;
    }),
  listAttempts: (jdId: string) => read().attempts.filter((a) => a.jd_id === jdId),

  /* llm call log */
  logLLMCall: (c: Omit<LLMCallRecord, "created_at">) =>
    update((db) => {
      db.llmCalls.push({ ...c, created_at: now() });
      if (db.llmCalls.length > 2000) db.llmCalls = db.llmCalls.slice(-2000);
    }),

  /* delete everything */
  deleteAll: () => write(empty()),
};
