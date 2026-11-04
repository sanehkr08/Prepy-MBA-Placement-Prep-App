/**
 * Impromptu speaking: a fresh topic (P17), then feedback on what was said (P18).
 * Pace and filler words are measured in code, so the numbers shown are exact.
 */
import { callLLM, LLMError } from "./llm";
import { store, type SpeechRecord } from "./store";
import { ImpromptuScoreSchema, ImpromptuTopicSchema, type ImpromptuTopic } from "./schemas";
import { IMPROMPTU_CATEGORIES, P17, P18, type ImpromptuCategory } from "./prompts";
import { IMPROMPTU_STYLES, THEMES, isRepeat, pick } from "./topics";

export const PREP_SECONDS = [15, 30, 60] as const;
export const SPEAK_SECONDS = [60, 120, 180] as const;

// Filler words and phrases counted in a transcript. "like" and "so" are left out: too often used correctly.
const FILLERS = ["um", "uh", "erm", "hmm", "basically", "actually", "literally", "you know", "i mean", "kind of", "sort of"];

export function speechStats(transcript: string, seconds: number) {
  const text = ` ${transcript.toLowerCase().replace(/[^a-z' ]+/g, " ")} `;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const fillers: Record<string, number> = {};
  for (const f of FILLERS) {
    const n = text.split(` ${f} `).length - 1;
    if (n) fillers[f] = n;
  }
  const filler_total = Object.values(fillers).reduce((a, b) => a + b, 0);
  const wpm = seconds > 0 ? Math.round((words / seconds) * 60) : 0;
  return { words, wpm, fillers, filler_total };
}

/**
 * A fresh topic from one of the chosen categories: a random theme and style each time,
 * never one already seen (`exclude`: topics shown in this session).
 */
export async function newTopic(categories: string[], exclude: string[] = []): Promise<ImpromptuTopic> {
  const valid = categories.filter((c): c is ImpromptuCategory => c in IMPROMPTU_CATEGORIES);
  if (!valid.length) throw new LLMError("no category", "Pick at least one kind of topic.", 400);
  const roles = Array.from(new Set((await store.listJDs()).map((j) => j.role))).slice(0, 6);
  const seen = [...(await store.listSpeeches(25)).map((s) => s.data.topic), ...exclude];
  let out: ImpromptuTopic | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    out = await callLLM({
      name: P17.name,
      version: P17.version,
      system: P17.system,
      user: P17.user({ category: pick(valid), roles, recent: seen, theme: pick(THEMES), style: pick(IMPROMPTU_STYLES) }),
      schema: ImpromptuTopicSchema,
      maxTokens: 300,
      temperature: 0.95,
    });
    if (!isRepeat(out.topic, seen)) break;
  }
  return out!;
}

/** Score one speech and save it. */
export async function scoreSpeech(input: {
  topic: string;
  category: string;
  prep_seconds: number;
  speak_seconds: number;
  duration_seconds: number;
  transcript: string;
  input_mode: "typed" | "voice";
}): Promise<SpeechRecord> {
  const topic = input.topic.trim().slice(0, 300);
  if (!topic) throw new LLMError("no topic", "The topic is missing.", 400);
  const transcript = input.transcript.trim().slice(0, 8000);
  const seconds = Math.max(1, Math.min(Math.round(input.duration_seconds), 600));
  const typed = input.input_mode === "typed";
  // Pace only means something for a spoken answer.
  const stats = { ...speechStats(transcript, seconds), ...(typed ? { wpm: 0 } : {}) };
  const result = await callLLM({
    name: P18.name,
    version: P18.version,
    system: P18.system,
    user: P18.user({
      topic,
      transcript,
      seconds,
      target: input.speak_seconds,
      words: stats.words,
      wpm: stats.wpm,
      typed,
      fillers: Object.entries(stats.fillers)
        .map(([f, n]) => `"${f}" ×${n}`)
        .join(", "),
    }),
    schema: ImpromptuScoreSchema,
    maxTokens: 2000,
  });
  result.overall_score = Math.round(result.overall_score);
  return await store.createSpeech({
    topic,
    category: input.category.slice(0, 60),
    prep_seconds: input.prep_seconds,
    speak_seconds: input.speak_seconds,
    duration_seconds: seconds,
    transcript,
    input_mode: input.input_mode,
    stats,
    result,
  });
}
