/**
 * Mock interviews: pick a realistic mix of questions from the user's kit, write
 * follow-ups from their answers (P15), and score the whole interview (P16).
 */
import { callLLM, LLMError } from "./llm";
import { store, type MockData, type MockQuestion, type MockRecord } from "./store";
import { FollowupSchema, MockScoreSchema, KIT_SECTIONS, type MockScore } from "./schemas";
import { P15, P16 } from "./prompts";
import { ensureConceptQuestions, ensureSection, practiceItems, requireJD, type PracticeItem } from "./prep";

export const MOCK_LENGTHS = [5, 8, 10] as const;
export const MOCK_SECONDS = [120, 180, 240] as const;
const MAX_FOLLOWUPS = 2;

type Slot = { from: PracticeItem["category"][]; types?: PracticeItem["type"][] };

// What a real interview looks like at each length, after the "Tell me about yourself" opener.
const PLAN: Record<number, Slot[]> = {
  5: [
    { from: ["resume"], types: ["resume", "gap"] },
    { from: ["questions", "concepts"] },
    { from: ["cases", "situational"] },
    { from: ["behavioral"] },
  ],
  8: [
    { from: ["resume"], types: ["resume", "gap"] },
    { from: ["resume"], types: ["resume", "gap"] },
    { from: ["questions"] },
    { from: ["concepts"] },
    { from: ["cases"] },
    { from: ["situational"] },
    { from: ["behavioral"] },
  ],
  10: [
    { from: ["resume"], types: ["resume", "gap"] },
    { from: ["resume"], types: ["resume", "gap"] },
    { from: ["questions"] },
    { from: ["questions"] },
    { from: ["concepts"] },
    { from: ["cases"] },
    { from: ["situational"] },
    { from: ["behavioral"] },
    { from: ["behavioral"] },
  ],
};

const shuffle = <T>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const toQuestion = (it: PracticeItem): MockQuestion => ({
  item_id: it.id,
  type: it.type,
  label: it.label,
  text: it.text,
  followup_eligible: false,
  answer: "",
  followup: "",
  followup_answer: "",
  input_mode: "typed",
});

/** Start a mock interview for a JD or role kit. Builds any missing kit sections first. */
export async function startMock(jdId: string, length: number, seconds: number): Promise<MockRecord> {
  await requireJD(jdId);
  if (!MOCK_LENGTHS.includes(length as (typeof MOCK_LENGTHS)[number])) throw new LLMError("bad length", "Choose 5, 8 or 10 questions.", 400);
  if (!MOCK_SECONDS.includes(seconds as (typeof MOCK_SECONDS)[number])) throw new LLMError("bad time", "Choose 2, 3 or 4 minutes.", 400);
  for (const s of KIT_SECTIONS) await ensureSection(jdId, s);
  await ensureConceptQuestions(jdId).catch(() => undefined);

  const all = await practiceItems(jdId);
  // Prefer questions not practised yet, so mocks don't repeat what the user has already done.
  const done = new Set((await store.listAttempts(jdId)).map((a) => a.item_id));
  const used = new Set<string>();
  const pickFrom = (pool: PracticeItem[]) => {
    const fresh = shuffle(pool.filter((i) => !used.has(i.id)));
    const it = fresh.find((i) => !done.has(i.id)) ?? fresh[0];
    if (it) used.add(it.id);
    return it;
  };

  const intro = all.find((i) => i.id === "intro-0");
  const picked: PracticeItem[] = intro ? [intro] : [];
  if (intro) used.add(intro.id);
  for (const slot of PLAN[length]) {
    const pool = all.filter((i) => slot.from.includes(i.category) && (!slot.types || slot.types.includes(i.type)));
    const it = pickFrom(pool) ?? pickFrom(all.filter((i) => i.id !== "intro-0"));
    if (it) picked.push(it);
  }
  if (picked.length < 2) throw new LLMError("no questions", "This kit has too few questions for a mock interview yet.", 400);

  // Up to two follow-ups, on the questions a real interviewer probes most: resume and behavioral stories.
  const questions = picked.map(toQuestion);
  questions
    .map((q, i) => ({ q, i }))
    .filter(({ q, i }) => i > 0 && ["resume", "gap", "behavioral", "situational"].includes(q.type))
    .slice(0, MAX_FOLLOWUPS)
    .forEach(({ q }) => (q.followup_eligible = true));

  const data: MockData = { length: questions.length, seconds_per_question: seconds, questions, result: null };
  return await store.createMock(jdId, data);
}

export async function requireMock(id: string): Promise<MockRecord> {
  const m = await store.getMock(id);
  if (!m) throw new LLMError("no mock", "This mock interview was not found.", 404);
  return m;
}

/**
 * Save one answer. For a follow-up-eligible question's main answer, returns the
 * interviewer's follow-up question; the next call saves the follow-up answer.
 */
export async function answerMock(
  id: string,
  index: number,
  stage: "main" | "followup",
  answer: string,
  inputMode: "typed" | "voice",
): Promise<{ followup: string | null }> {
  const m = await requireMock(id);
  if (m.data.result) throw new LLMError("finished", "This mock interview is already finished.", 400);
  const q = m.data.questions[index];
  if (!q) throw new LLMError("no question", "That question is not part of this interview.", 400);
  const text = answer.trim().slice(0, 6000);

  if (stage === "followup") {
    q.followup_answer = text;
    await store.saveMock(id, m.data);
    return { followup: null };
  }
  q.answer = text;
  q.input_mode = inputMode;
  if (q.followup_eligible && !q.followup) {
    const jd = await requireJD(m.jd_id);
    try {
      const out = await callLLM({
        name: P15.name,
        version: P15.version,
        system: P15.system,
        user: P15.user({ jd: jd.data, company: jd.company, question: q.text, answer: text }),
        schema: FollowupSchema,
        maxTokens: 300,
      });
      q.followup = out.followup.trim();
    } catch {
      // A follow-up is a bonus: if the model is unavailable, the interview simply moves on.
      q.followup = "";
      q.followup_eligible = false;
    }
  }
  await store.saveMock(id, m.data);
  return { followup: q.followup || null };
}

/** Score the whole interview and save the scorecard. */
export async function finishMock(id: string): Promise<MockScore> {
  const m = await requireMock(id);
  if (m.data.result) return m.data.result as MockScore;
  const jd = await requireJD(m.jd_id);
  const result = await callLLM({
    name: P16.name,
    version: P16.version,
    system: P16.system,
    user: P16.user({
      jd: jd.data,
      company: jd.company,
      items: m.data.questions.map((q, i) => ({
        index: i + 1,
        type: q.type,
        question: q.text,
        answer: q.answer,
        followup: q.followup,
        followup_answer: q.followup_answer,
      })),
    }),
    schema: MockScoreSchema,
    maxTokens: 5000,
  });
  // Keep one score per question, in order, even if the model skipped or repeated one.
  const byIndex = new Map(result.questions.map((q) => [q.index, q]));
  result.questions = m.data.questions.map(
    (_, i) =>
      byIndex.get(i + 1) ?? {
        index: i + 1,
        scores: { structure: 1, relevance: 1, evidence_or_concepts: 1, clarity: 1 },
        comment: "Not scored.",
        better: "",
      },
  );
  result.overall_score = Math.round(result.overall_score);
  m.data.result = result;
  await store.saveMock(id, m.data, true);
  return result;
}
