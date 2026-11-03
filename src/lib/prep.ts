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
  ModelAnswerSchema,
  type FitMap,
  type Concepts,
  type Questions,
  type Cases,
  type Situational,
  type Outline,
  type ModelAnswer,
  type KitSection,
} from "./schemas";
import { P3, P4, P5, P6, P7, P8, P10, P11, conceptNames } from "./prompts";
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

// One generation per key at a time: a second request for the same thing (double click,
// background prefetch, React re-render) waits for the first instead of paying for another call.
const inFlight = new Map<string, Promise<unknown>>();
function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  const running = inFlight.get(key);
  if (running) return running as Promise<T>;
  const p = run().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

export async function ensureFit(jdId: string, force = false): Promise<FitMap> {
  const cached = store.getFitMap(jdId);
  if (cached && !force) return cached;
  return once(`fit:${jdId}`, () => generateFit(jdId));
}

async function generateFit(jdId: string): Promise<FitMap> {
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
  return once(`kit:${jdId}:${section}`, () => generate(jdId, section));
}

/** Build the kit sections one by one in the background, so they are ready when opened. */
export async function prefetchKit(jdId: string) {
  for (const section of ["concepts", "situational", "cases", "questions"] as const) {
    try {
      await ensureSection(jdId, section);
    } catch (err) {
      console.warn(`[prefetch] ${section} failed: ${err instanceof Error ? err.message : err}`);
      return;
    }
  }
}

/* ---------- Generate More: add new items to a section without repeating ---------- */

export const MORE_TABS = ["concepts", "questions", "cases", "situational", "behavioral", "resume"] as const;
export type MoreTab = (typeof MORE_TABS)[number];
export const MORE_SECTION: Record<MoreTab, KitSection> = {
  concepts: "concepts",
  questions: "questions",
  cases: "cases",
  situational: "situational",
  behavioral: "situational",
  resume: "questions",
};

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function generateMore(jdId: string, tab: MoreTab): Promise<{ data: unknown; added: number }> {
  return once(`more:${jdId}:${tab}`, async () => {
    const section = MORE_SECTION[tab];
    const current = await ensureSection(jdId, section);
    const jd = requireJD(jdId);
    const profile = requireProfile();
    const lines = linesAsPrompt(profileLines(profile.data));
    const base = { name: P10.name, version: P10.version, system: P10.system };
    let added = 0;
    let data: unknown;

    if (section === "concepts") {
      const cur = current as Concepts;
      const fit = await ensureFit(jdId);
      const gaps = fit.items.filter((i) => i.label !== "Strong").map((i) => i.requirement);
      const more = await callLLM({ ...base, user: P10.concepts(jd.data, jd.company, gaps, cur), schema: ConceptsSchema });
      const seen = new Set(cur.topics.flatMap((t) => t.items.map((c) => norm(c.name))));
      // Append so existing ids (c-topic-item) used by practice and the study plan stay stable.
      const topics = cur.topics.map((t) => ({ ...t, items: [...t.items] }));
      for (const t of more.topics) {
        const items = t.items.filter((c) => !seen.has(norm(c.name)) && seen.add(norm(c.name)));
        if (!items.length) continue;
        added += items.length;
        const same = topics.find((x) => norm(x.name) === norm(t.name));
        if (same) same.items.push(...items);
        else topics.push({ ...t, items });
      }
      data = { topics };
    } else if (section === "questions") {
      const cur = current as Questions;
      const fit = await ensureFit(jdId);
      const concepts = (await ensureSection(jdId, "concepts")) as Concepts;
      const focus = tab === "resume" ? "resume" : "role";
      const more = await callLLM({
        ...base,
        user: P10.questions(jd.data, jd.company, conceptNames(concepts), fit, lines, cur, focus),
        schema: QuestionsSchema,
      });
      const want = focus === "resume" ? ["resume", "gap"] : ["role_knowledge", "technical"];
      const seen = new Set(cur.questions.map((q) => norm(q.text)));
      let rank = Math.max(0, ...cur.questions.map((q) => q.likelihood_rank || 0));
      const fresh = more.questions
        .filter((q) => want.includes(q.category) && !seen.has(norm(q.text)) && seen.add(norm(q.text)))
        .map((q) => ({ ...q, likelihood_rank: ++rank }));
      added = fresh.length;
      data = { questions: [...cur.questions, ...fresh] };
    } else if (section === "cases") {
      const cur = current as Cases;
      const concepts = (await ensureSection(jdId, "concepts")) as Concepts;
      const more = await callLLM({ ...base, user: P10.cases(jd.data, jd.company, conceptNames(concepts), cur), schema: CasesSchema });
      const seen = new Set(cur.cases.map((c) => norm(c.title)));
      const fresh = more.cases.filter((c) => !seen.has(norm(c.title)) && seen.add(norm(c.title)));
      added = fresh.length;
      data = { cases: [...cur.cases, ...fresh] };
    } else {
      const cur = current as Situational;
      const kind = tab === "behavioral" ? "behavioral" : "situational";
      const more = await callLLM({ ...base, user: P10.situational(jd.data, jd.company, cur, kind), schema: SituationalSchema });
      const seen = new Set(cur[kind].map((q) => norm(q.text)));
      const fresh = more[kind].filter((q) => !seen.has(norm(q.text)) && seen.add(norm(q.text)));
      added = fresh.length;
      data = { ...cur, [kind]: [...cur[kind], ...fresh] };
    }

    if (added) store.saveKit(jdId, section, data, `${store.getKit(jdId, section)?.prompt_version ?? "v1"}+${P10.version}`);
    return { data: added ? data : current, added };
  });
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

/** Model answer for one practice item, in the candidate's voice; cached by item text. */
export async function ensureModelAnswer(jdId: string, itemId: string): Promise<ModelAnswer> {
  const item = practiceItems(jdId).find((i) => i.id === itemId);
  if (!item) throw new LLMError("no item", "Practice item not found.", 404);
  const key = "model:" + item.text.slice(0, 200);
  const cached = store.getKit(jdId, key);
  if (cached) return cached.data as ModelAnswer;
  return once(`${jdId}:${key}`, async () => {
    const jd = requireJD(jdId);
    const lines = profileLines(requireProfile().data);
    const data = await callLLM({
      name: P11.name,
      version: P11.version,
      system: P11.system,
      user: P11.user({
        itemType: item.type,
        question: item.text,
        hint: item.hint,
        jd: jd.data,
        company: jd.company,
        profile: linesAsPrompt(lines),
      }),
      schema: ModelAnswerSchema,
      maxTokens: 3000,
    });
    // Grounding guard: drop any cited line that is not in the profile.
    const valid = new Set(lines.map((l) => l.ref));
    data.source_refs = data.source_refs.filter((r) => valid.has(r));
    // The answer is spoken, so strip line refs like "(EX2.B1, EX2.B7)" or "[EX2.B8]" left in the text.
    // Placeholders such as "[add metric]" are lowercase words, so they are kept.
    const refs = /\s*[([](?:[A-Z]{1,4}\d+(?:\.[A-Z]+\d+)?(?:,\s*)?)+[)\]]/g;
    data.sections = data.sections.map((sec) => ({ ...sec, text: sec.text.replace(refs, "") }));
    store.saveKit(jdId, key, data, P11.version);
    return data;
  });
}

/* ---------- Practice items and study plan (built in code) ---------- */

/** Practice categories match the prep kit tabs; `group` is the subcategory inside one. */
export const PRACTICE_CATEGORIES = ["concepts", "questions", "cases", "situational", "behavioral", "resume"] as const;
export type PracticeCategory = (typeof PRACTICE_CATEGORIES)[number];

export type PracticeItem = {
  id: string;
  type: "concept" | "case" | "situational" | "behavioral" | "gap" | "resume" | "question";
  category: PracticeCategory;
  group: string;
  label: string;
  text: string;
  hint: string;
  concepts: string[];
};

const short = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}…` : t);

export function practiceItems(jdId: string): PracticeItem[] {
  const items: PracticeItem[] = [];
  const concepts = store.getKit(jdId, "concepts")?.data as Concepts | undefined;
  const questions = store.getKit(jdId, "questions")?.data as Questions | undefined;
  const cases = store.getKit(jdId, "cases")?.data as Cases | undefined;
  const sit = store.getKit(jdId, "situational")?.data as Situational | undefined;

  // Ids are positional (c-topic-item, q-n, …) and stay stable because Generate More only appends.
  concepts?.topics.forEach((t, ti) =>
    t.items.forEach((c, ci) =>
      items.push({
        id: `c-${ti}-${ci}`,
        type: "concept",
        category: "concepts",
        group: t.name,
        label: c.name,
        text: `Explain "${c.name}" as you would to an interviewer, and say why it matters in this role.`,
        hint: c.what,
        concepts: [c.name],
      }),
    ),
  );
  const qs = questions?.questions.map((q, i) => ({ q, i })) ?? [];
  qs.filter(({ q }) => q.category === "role_knowledge" || q.category === "technical").forEach(({ q, i }) =>
    items.push({
      id: `q-${i}`,
      type: "question",
      category: "questions",
      group: q.category === "technical" ? "Technical" : "Role knowledge",
      label: short(q.text, 90),
      text: q.text,
      hint: q.linked_concepts.length ? `Use: ${q.linked_concepts.join(", ")}` : "",
      concepts: q.linked_concepts,
    }),
  );
  cases?.cases.forEach((c, i) =>
    items.push({
      id: `case-${i}`,
      type: "case",
      category: "cases",
      group: "",
      label: c.title,
      text: c.prompt,
      hint: c.framework,
      concepts: c.linked_concepts,
    }),
  );
  sit?.situational.forEach((s, i) =>
    items.push({
      id: `s-${i}`,
      type: "situational",
      category: "situational",
      group: s.competency || "General",
      label: short(s.text, 90),
      text: s.text,
      hint: s.competency ? `Competency: ${s.competency}` : "",
      concepts: [],
    }),
  );
  sit?.behavioral.forEach((s, i) =>
    items.push({
      id: `b-${i}`,
      type: "behavioral",
      category: "behavioral",
      group: s.competency || "General",
      label: short(s.text, 90),
      text: s.text,
      hint: "Answer with STAR, using a real example from your resume.",
      concepts: [],
    }),
  );
  qs.filter(({ q }) => q.category === "resume" || q.category === "gap").forEach(({ q, i }) =>
    items.push({
      id: `q-${i}`,
      type: q.category === "gap" ? "gap" : "resume",
      category: "resume",
      group: q.category === "gap" ? "Gap questions" : "Resume questions",
      label: short(q.text, 90),
      text: q.text,
      hint:
        q.category === "gap"
          ? "Be honest about the gap, then bridge it with your closest real experience."
          : "Answer with STAR, using the real details from your resume.",
      concepts: q.linked_concepts,
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
