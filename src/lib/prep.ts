/**
 * Server-side orchestration: builds and caches the fit map and kit sections,
 * and enforces grounding rules in code (not only in prompts).
 */
import { callLLM, LLMError } from "./llm";
import { store } from "./store";
import {
  FitMapSchema,
  ConceptsSchema,
  QuestionsSchema,
  CasesSchema,
  SituationalSchema,
  OutlineSchema,
  type FitMap,
  type Concepts,
  type Questions,
  type Cases,
  type Situational,
  type Outline,
  type KitSection,
} from "./schemas";
import { P3, P4, P5, P6, P7, P8, conceptNames } from "./prompts";
import { profileLines, linesAsPrompt } from "./profile-lines";

export function requireProfile() {
  const p = store.getProfile();
  if (!p) throw new LLMError("no profile", "Upload and save your resume first.", 400);
  return p;
}

export function requireJD(jdId: string) {
  const jd = store.getJD(jdId);
  if (!jd) throw new LLMError("no jd", "This job description was not found.", 404);
  return jd;
}

export async function ensureFit(jdId: string, force = false): Promise<FitMap> {
  const cached = store.getFitMap(jdId);
  if (cached && !force) return cached;
  const jd = requireJD(jdId);
  const profile = requireProfile();
  const lines = profileLines(profile.data);
  const raw = await callLLM({
    name: P3.name,
    version: P3.version,
    system: P3.system,
    user: P3.user(jd.data, jd.company, linesAsPrompt(lines)),
    schema: FitMapSchema,
  });
  const validRefs = new Set(lines.map((l) => l.ref));
  // Grounding guard: a Strong label needs a real source line; otherwise downgrade.
  const items = raw.items.map((it) => {
    const ref = it.source_ref && validRefs.has(it.source_ref) ? it.source_ref : null;
    const label = it.label === "Strong" && !ref ? "Partial" : it.label;
    return { ...it, source_ref: label === "Gap" ? null : ref, label };
  });
  const counts = {
    Strong: items.filter((i) => i.label === "Strong").length,
    Partial: items.filter((i) => i.label === "Partial").length,
    Gap: items.filter((i) => i.label === "Gap").length,
  };
  const ratio = items.length ? (counts.Strong + counts.Partial * 0.5) / items.length : 0;
  const overall_label = ratio >= 0.7 ? "Strong" : ratio >= 0.4 ? "Moderate" : "Low";
  return store.saveFitMap(jdId, { items, counts, overall_label });
}

async function generate(jdId: string, section: KitSection): Promise<unknown> {
  const jd = requireJD(jdId);
  const profile = requireProfile();
  const lines = linesAsPrompt(profileLines(profile.data));
  switch (section) {
    case "concepts": {
      const fit = await ensureFit(jdId);
      const gaps = fit.items.filter((i) => i.label !== "Strong").map((i) => i.requirement);
      const data = await callLLM({
        name: P4.name,
        version: P4.version,
        system: P4.system,
        user: P4.user(jd.data, jd.company, gaps),
        schema: ConceptsSchema,
      });
      store.saveKit(jdId, section, data, P4.version);
      return data;
    }
    case "questions": {
      const fit = await ensureFit(jdId);
      const concepts = (await ensureSection(jdId, "concepts")) as Concepts;
      const data = await callLLM({
        name: P5.name,
        version: P5.version,
        system: P5.system,
        user: P5.user(jd.data, jd.company, conceptNames(concepts), fit, lines),
        schema: QuestionsSchema,
      });
      data.questions.sort((a, b) => (a.likelihood_rank || 99) - (b.likelihood_rank || 99));
      store.saveKit(jdId, section, data, P5.version);
      return data;
    }
    case "cases": {
      const concepts = (await ensureSection(jdId, "concepts")) as Concepts;
      const data = await callLLM({
        name: P6.name,
        version: P6.version,
        system: P6.system,
        user: P6.user(jd.data, jd.company, conceptNames(concepts)),
        schema: CasesSchema,
      });
      store.saveKit(jdId, section, data, P6.version);
      return data;
    }
    case "situational": {
      const data = await callLLM({
        name: P7.name,
        version: P7.version,
        system: P7.system,
        user: P7.user(jd.data, jd.company),
        schema: SituationalSchema,
      });
      store.saveKit(jdId, section, data, P7.version);
      return data;
    }
  }
}

export async function ensureSection(jdId: string, section: KitSection, force = false) {
  const cached = store.getKit(jdId, section);
  if (cached && !force) return cached.data;
  return generate(jdId, section);
}

/** STAR outline for one question, cached by question text. */
export async function ensureOutline(jdId: string, question: string): Promise<Outline> {
  const key = "outline:" + question.slice(0, 200);
  const cached = store.getKit(jdId, key);
  if (cached) return cached.data as Outline;
  const jd = requireJD(jdId);
  const profile = requireProfile();
  const lines = profileLines(profile.data);
  const data = await callLLM({
    name: P8.name,
    version: P8.version,
    system: P8.system,
    user: P8.user(question, jd.data, jd.company, linesAsPrompt(lines)),
    schema: OutlineSchema,
  });
  const valid = new Set(lines.map((l) => l.ref));
  data.source_refs = data.source_refs.filter((r) => valid.has(r));
  store.saveKit(jdId, key, data, P8.version);
  return data;
}

/* ---------- Practice items and study plan (built in code) ---------- */

export type PracticeItem = {
  id: string;
  type: "concept" | "case" | "situational" | "behavioral" | "gap" | "question";
  label: string;
  text: string;
  hint: string;
  concepts: string[];
};

export function practiceItems(jdId: string): PracticeItem[] {
  const items: PracticeItem[] = [];
  const concepts = store.getKit(jdId, "concepts")?.data as Concepts | undefined;
  const questions = store.getKit(jdId, "questions")?.data as Questions | undefined;
  const cases = store.getKit(jdId, "cases")?.data as Cases | undefined;
  const sit = store.getKit(jdId, "situational")?.data as Situational | undefined;

  concepts?.topics.forEach((t, ti) =>
    t.items.forEach((c, ci) => {
      if (c.priority === "High")
        items.push({
          id: `c-${ti}-${ci}`,
          type: "concept",
          label: `Concept: ${c.name}`,
          text: `Explain "${c.name}" as you would to an interviewer, and say why it matters in this role.`,
          hint: c.what,
          concepts: [c.name],
        });
    }),
  );
  cases?.cases.forEach((c, i) =>
    items.push({
      id: `case-${i}`,
      type: "case",
      label: `Case: ${c.title}`,
      text: c.prompt,
      hint: c.framework,
      concepts: c.linked_concepts,
    }),
  );
  questions?.questions.forEach((q, i) => {
    if (q.category === "gap" || q.category === "role_knowledge" || q.category === "technical")
      items.push({
        id: `q-${i}`,
        type: q.category === "gap" ? "gap" : "question",
        label: `${q.category === "gap" ? "Gap" : "Question"}: ${q.text.slice(0, 48)}${q.text.length > 48 ? "…" : ""}`,
        text: q.text,
        hint: q.linked_concepts.length ? `Use: ${q.linked_concepts.join(", ")}` : "",
        concepts: q.linked_concepts,
      });
  });
  sit?.situational.forEach((s, i) =>
    items.push({
      id: `s-${i}`,
      type: "situational",
      label: `Situational: ${s.text.slice(0, 40)}…`,
      text: s.text,
      hint: s.competency ? `Competency: ${s.competency}` : "",
      concepts: [],
    }),
  );
  sit?.behavioral.forEach((s, i) =>
    items.push({
      id: `b-${i}`,
      type: "behavioral",
      label: `Behavioral: ${s.text.slice(0, 40)}…`,
      text: s.text,
      hint: "Answer with STAR, using a real example from your resume.",
      concepts: [],
    }),
  );
  return items;
}

export type PlanItem = { id: string; text: string };

export function studyPlan(jdId: string): PlanItem[] {
  const plan: PlanItem[] = [];
  const concepts = store.getKit(jdId, "concepts")?.data as Concepts | undefined;
  const cases = store.getKit(jdId, "cases")?.data as Cases | undefined;
  const questions = store.getKit(jdId, "questions")?.data as Questions | undefined;
  const all =
    concepts?.topics.flatMap((t, ti) => t.items.map((c, ci) => ({ c, id: `c-${ti}-${ci}` }))) ?? [];
  const ordered = [
    ...all.filter((x) => x.c.covers_gap && x.c.priority === "High"),
    ...all.filter((x) => !x.c.covers_gap && x.c.priority === "High"),
    ...all.filter((x) => x.c.covers_gap && x.c.priority !== "High"),
  ];
  ordered.slice(0, 5).forEach((x) => plan.push({ id: `plan-${x.id}`, text: `Study: ${x.c.name}` }));
  if (cases?.cases[0]) plan.push({ id: "plan-case-0", text: `Case: ${cases.cases[0].title}` });
  questions?.questions
    .filter((q) => q.category === "gap")
    .slice(0, 2)
    .forEach((q, i) => plan.push({ id: `plan-gap-${i}`, text: `Gap answer: ${q.text}` }));
  return plan;
}
