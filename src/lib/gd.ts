/**
 * Group discussion practice. Quick mode: one contribution, then feedback.
 * Full mode: three AI members speak in rounds (P20); after each round the user adds a
 * point or passes; after the last round the user summarises; then feedback (P21).
 */
import { callLLM, LLMError } from "./llm";
import { store, type GDData, type GDRecord, type GDTurn } from "./store";
import { GDRoundSchema, GDScoreSchema, GDTopicSchema, type GDScore } from "./schemas";
import { P19, P20, P21 } from "./prompts";
import { GD_STYLES, THEMES, isRepeat, pick } from "./topics";

export const GD_ROUNDS = 3;
export const YOU = "You";

// Three members with distinct styles, so the discussion has real disagreement to respond to.
const MEMBERS = [
  { name: "Aditi", style: "data-driven analyst; backs points with logic, trade-offs and real-world examples" },
  { name: "Rahul", style: "devil's advocate; challenges the popular view and argues the other side firmly but politely" },
  { name: "Meera", style: "consensus builder; connects others' points, looks for middle ground and practical next steps" },
];

/** A fresh topic: a random theme and style each time, never one already seen (`exclude`: shown this session). */
export async function gdTopic(exclude: string[] = []) {
  const seen = [...store.recentGDTopics(25), ...exclude];
  let out = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    out = await callLLM({
      name: P19.name,
      version: P19.version,
      system: P19.system,
      user: P19.user({ recent: seen, theme: pick(THEMES), style: pick(GD_STYLES) }),
      schema: GDTopicSchema,
      maxTokens: 300,
      temperature: 0.95,
    });
    if (!isRepeat(out.topic, seen)) break;
  }
  return out!;
}

/** `participants`: other members besides the user. 0 = just the user (quick mode), or 2 or 3. */
export function startGD(input: { participants: number; topic: string; context: string; input_mode: string }): GDRecord {
  const topic = input.topic.trim().slice(0, 300);
  if (!topic) throw new LLMError("no topic", "The topic is missing.", 400);
  if (![0, 2, 3].includes(input.participants)) throw new LLMError("bad count", "Choose 0, 2 or 3 other participants.", 400);
  const data: GDData = {
    mode: input.participants === 0 ? "quick" : "full",
    topic,
    context: input.context.trim().slice(0, 600),
    // With two, keep the analyst and the devil's advocate so there is real disagreement.
    members: MEMBERS.slice(0, input.participants),
    turns: [],
    rounds_done: 0,
    input_mode: input.input_mode === "typed" ? "typed" : "voice",
    result: null,
  };
  return store.createGD(data);
}

export function requireGD(id: string): GDRecord {
  const g = store.getGD(id);
  if (!g) throw new LLMError("no gd", "This group discussion was not found.", 404);
  return g;
}

const transcriptOf = (turns: GDTurn[]) =>
  turns
    .filter((t) => t.kind !== "pass")
    .map((t) => `${t.speaker}: ${t.text}`)
    .join("\n");

async function aiRound(data: GDData) {
  const round = data.rounds_done + 1;
  const out = await callLLM({
    name: P20.name,
    version: P20.version,
    system: P20.system,
    user: P20.user({
      topic: data.topic,
      context: data.context,
      members: data.members,
      transcript: transcriptOf(data.turns),
      round,
      rounds: GD_ROUNDS,
    }),
    schema: GDRoundSchema,
    maxTokens: 1500,
  });
  // Keep the members' order and names, whatever the model returned.
  for (const m of data.members) {
    const p = out.points.find((x) => x.name.trim().toLowerCase() === m.name.toLowerCase());
    if (p?.text.trim()) data.turns.push({ speaker: m.name, text: p.text.trim(), round, kind: "point" });
  }
  data.rounds_done = round;
}

/**
 * The user's move.
 * - "start": let the members open (full mode, before anyone has spoken)
 * - "speak": add a point (the first one, before anyone else, counts as opening the GD)
 * - "pass": skip this round
 * - "summary": the closing summary (full mode, after the last round); quick mode's single answer
 * Returns what the user does next: "turn", "summary" or "finish".
 */
export async function takeTurn(id: string, action: string, text: string): Promise<{ gd: GDRecord; next: "turn" | "summary" | "finish" }> {
  const g = requireGD(id);
  const data = g.data;
  if (data.result) throw new LLMError("finished", "This discussion is already finished.", 400);
  const said = text.trim().slice(0, 6000);

  if (data.mode === "quick" || action === "summary") {
    data.turns.push({ speaker: YOU, text: said, round: data.rounds_done, kind: data.mode === "quick" ? "point" : "summary" });
    store.saveGD(id, data);
    return { gd: { ...g, data }, next: "finish" };
  }

  if (action === "speak") {
    const opening = data.turns.length === 0;
    data.turns.push({ speaker: YOU, text: said, round: data.rounds_done, kind: opening ? "open" : "point" });
  } else if (action === "pass") {
    data.turns.push({ speaker: YOU, text: "", round: data.rounds_done, kind: "pass" });
  } else if (action !== "start" || data.turns.length) {
    throw new LLMError("bad action", "That move is not possible now.", 400);
  }

  if (data.rounds_done < GD_ROUNDS) await aiRound(data);
  store.saveGD(id, data);
  return { gd: { ...g, data }, next: data.rounds_done >= GD_ROUNDS ? "summary" : "turn" };
}

/** Score the user's part in the discussion and save the feedback. */
export async function finishGD(id: string): Promise<GDScore> {
  const g = requireGD(id);
  if (g.data.result) return g.data.result as GDScore;
  const yours = g.data.turns.filter((t) => t.speaker === YOU);
  const result = await callLLM({
    name: P21.name,
    version: P21.version,
    system: P21.system,
    user: P21.user({
      topic: g.data.topic,
      mode: g.data.mode,
      transcript: g.data.turns.map((t) => `${t.speaker}: ${t.kind === "pass" ? "(passed)" : t.text || "(silent)"}`).join("\n"),
      yourTurns: yours.map((t, i) => ({ index: i + 1, text: t.kind === "pass" ? "" : t.text })),
    }),
    schema: GDScoreSchema,
    maxTokens: 2500,
  });
  result.overall_score = Math.round(result.overall_score);
  g.data.result = result;
  store.saveGD(id, g.data, true);
  return result;
}
