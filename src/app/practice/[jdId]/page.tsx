"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, Check, Mic, Square, Undo2, Redo2, ChevronDown, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { api, rememberJD } from "@/lib/client";
import type { PracticeScore } from "@/lib/schemas";
import { useDictation, useUndoableText } from "@/components/hooks";
import {
  AppShell,
  PageTitle,
  PanelCard,
  IconCircle,
  Badge,
  ErrorBox,
  PrimaryButton,
  SecondaryButton,
  Spinner,
  fieldInput,
} from "@/components/ui";

type Item = {
  id: string;
  type: string;
  category: string;
  group: string;
  label: string;
  text: string;
  hint: string;
  concepts: string[];
};
type ModelView = {
  structure: string;
  sections: { label: string; text: string }[];
  why_it_works: string[];
  placeholders: string[];
  sources: string[];
};
type QueueResponse = { jd: { id: string; company: string; role: string }; items: Item[]; attempted: string[] };

const TYPE_LABEL: Record<string, string> = {
  concept: "Concept",
  case: "Case study",
  situational: "Situational",
  behavioral: "Behavioral",
  gap: "Gap question",
  resume: "Resume question",
  question: "Interview question",
};
// Same categories, in the same order, as the prep kit tabs.
const CATEGORIES: { key: string; label: string }[] = [
  { key: "concepts", label: "Concepts" },
  { key: "questions", label: "Questions" },
  { key: "cases", label: "Cases" },
  { key: "situational", label: "Situational" },
  { key: "behavioral", label: "Behavioral" },
  { key: "resume", label: "Resume and gaps" },
];
const ALL = "All";
const selectClass =
  "min-h-[48px] w-full cursor-pointer rounded-2xl border-0 bg-white px-3.5 text-[15px] font-medium text-ink outline-none ring-1 ring-transparent focus:ring-ink";

// Which questions the user ticked, per JD. Only a convenience: the page works without it.
const selKey = (jdId: string) => `prepy:practice-selection:${jdId}`;
function loadSelection(jdId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(selKey(jdId)) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function saveSelection(jdId: string, ids: string[]) {
  try {
    localStorage.setItem(selKey(jdId), JSON.stringify(ids));
  } catch {
    /* storage unavailable */
  }
}
const SCORE_COLORS = ["bg-mint", "bg-peach", "bg-lavender", "bg-pink"];
const SCORE_LABELS: [keyof PracticeScore["scores"], string][] = [
  ["structure", "Structure"],
  ["relevance", "Relevance to the JD"],
  ["evidence_or_concepts", "Evidence and concepts"],
  ["clarity", "Clarity"],
];

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function PracticeInner() {
  const { jdId } = useParams<{ jdId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const text = useUndoableText();
  const { value: answer, set: setAnswer, reset: resetAnswer } = text;
  const [usedVoice, setUsedVoice] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<PracticeScore | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [model, setModel] = useState<{ state: "loading" | "done" | "error"; data?: ModelView; error?: string } | null>(null);
  const [showModel, setShowModel] = useState(false);
  const feedbackRef = useRef<HTMLElement>(null);
  const modelRef = useRef<HTMLElement>(null);

  const onDictated = useCallback(
    (t: string, phraseDone: boolean) => setAnswer(t, phraseDone ? "phrase" : "interim"),
    [setAnswer],
  );
  const dict = useDictation(onDictated);

  const load = useCallback(() => {
    setError(null);
    api<QueueResponse>(`/api/practice/${jdId}`)
      .then(setQueue)
      .catch((e: Error) => setError(e.message));
  }, [jdId]);

  useEffect(() => {
    rememberJD(jdId);
    void Promise.resolve().then(load);
  }, [jdId, load]);

  const currentId = search.get("item");
  const current = useMemo(() => {
    if (!queue) return null;
    return queue.items.find((i) => i.id === currentId) ?? queue.items[0] ?? null;
  }, [queue, currentId]);

  const [cat, setCat] = useState<string | null>(null);
  const [group, setGroup] = useState(ALL);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    // localStorage is only available after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(loadSelection(jdId));
  }, [jdId]);

  // Reset the answer when the item changes.
  const [shownId, setShownId] = useState<string | null>(null);
  if (current && current.id !== shownId) {
    setShownId(current.id);
    // A link to one question (e.g. from the prep kit) opens its category and subcategory.
    if (current.category !== cat) {
      setCat(current.category);
      setGroup((currentId && current.group) || ALL);
    } else if (group !== ALL && group !== current.group) setGroup(current.group || ALL);
    resetAnswer("");
    setResult(null);
    setScoreError(null);
    setUsedVoice(false);
    setModel(null);
    setShowModel(false);
  }

  // Undo/redo stop the mic first, so words still being recognised are not added straight back.
  function undo() {
    if (dict.listening) dict.abort();
    text.undo();
  }
  function redo() {
    if (dict.listening) dict.abort();
    text.redo();
  }

  function goTo(id: string) {
    if (dict.listening) dict.stop();
    router.replace(`/practice/${jdId}?item=${id}`, { scroll: false });
  }

  async function score() {
    if (!current) return;
    if (dict.listening) dict.stop();
    setScoring(true);
    setScoreError(null);
    try {
      const r = await api<{ result: PracticeScore }>("/api/practice/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdId, itemId: current.id, answer, inputMode: usedVoice ? "voice" : "typed" }),
      });
      setResult(r.result);
      requestAnimationFrame(() => feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      setQueue((q) => (q ? { ...q, attempted: Array.from(new Set([...q.attempted, current.id])) } : q));
    } catch (e) {
      setScoreError((e as Error).message);
    } finally {
      setScoring(false);
    }
  }

  async function seeModelAnswer() {
    if (!current) return;
    if (model?.state === "done" || model?.state === "loading") {
      setShowModel((v) => !v);
      return;
    }
    const itemId = current.id;
    setShowModel(true);
    setModel({ state: "loading" });
    try {
      const r = await api<{ model: ModelView }>("/api/practice/model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdId, itemId }),
      });
      // Ignore a late reply if the user has moved to another question.
      if (search.get("item") && search.get("item") !== itemId) return;
      setModel({ state: "done", data: r.model });
      requestAnimationFrame(() => modelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setModel({ state: "error", error: (e as Error).message });
    }
  }

  const activeCat = cat ?? current?.category ?? "concepts";
  const itemsIn = useCallback(
    (c: string, g: string) => queue?.items.filter((i) => i.category === c && (g === ALL || i.group === g)) ?? [],
    [queue],
  );
  // The practice set: the ticked questions in this subcategory, or all of them when none are ticked.
  const setFor = useCallback(
    (c: string, g: string) => {
      const scope = itemsIn(c, g);
      const ticked = scope.filter((i) => selected.includes(i.id));
      return ticked.length ? ticked : scope;
    },
    [itemsIn, selected],
  );
  const groups = useMemo(
    () => Array.from(new Set(itemsIn(activeCat, ALL).map((i) => i.group).filter(Boolean))),
    [itemsIn, activeCat],
  );
  const scopeItems = itemsIn(activeCat, group);
  const tickedInScope = scopeItems.filter((i) => selected.includes(i.id)).length;
  const practiceSet = setFor(activeCat, group);
  const position = current ? practiceSet.findIndex((i) => i.id === current.id) : -1;
  const prevItem = position > 0 ? practiceSet[position - 1] : null;
  const nextItem = position === -1 ? (practiceSet[0] ?? null) : (practiceSet[position + 1] ?? null);

  function chooseCategory(c: string) {
    setCat(c);
    setGroup(ALL);
    const first = setFor(c, ALL)[0];
    if (first) goTo(first.id);
  }
  function chooseGroup(g: string) {
    setGroup(g);
    const first = setFor(activeCat, g)[0];
    if (first) goTo(first.id);
  }
  function setTicked(ids: string[]) {
    setSelected(ids);
    saveSelection(jdId, ids);
  }
  function toggleTick(id: string) {
    setTicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  // Close the question checklist when clicking outside it.
  const pickerRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const el = pickerRef.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const panel = (
    <>
      <PanelCard title="How scoring works">
        <p className="text-sm">
          Answer by typing or by speaking. Prepy scores structure, relevance to this JD, use of evidence or role concepts,
          and clarity, from 1 to 5, then shows a stronger answer.
        </p>
      </PanelCard>
      <PanelCard title="Progress">
        <p className="text-[32px] font-medium leading-none">
          {queue?.attempted.length ?? 0}{" "}
          <span className="text-[15px] font-normal text-muted">of {queue?.items.length ?? 0} items practised</span>
        </p>
      </PanelCard>
      <Link href={`/kit/${jdId}`} className="inline-flex min-h-[44px] items-center self-center text-sm font-medium">
        Back to prep kit
      </Link>
    </>
  );

  return (
    <AppShell active="practice" jdId={jdId} panel={panel}>
      <PageTitle eyebrow={`Step 5 of 5${queue ? ` · ${queue.jd.role}${queue.jd.company ? ` · ${queue.jd.company}` : ""}` : ""}`}>
        Practice
      </PageTitle>

      {error ? (
        <div className="mt-8">
          <ErrorBox message={error} onRetry={load} />
        </div>
      ) : !queue ? (
        <div className="mt-8">
          <Spinner label="Preparing your practice queue. The first time can take a minute while the prep kit is built…" />
        </div>
      ) : !current ? (
        <p className="mt-8">No practice items yet. Open the prep kit first.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted">
              Category
              <select className={selectClass} value={activeCat} onChange={(e) => chooseCategory(e.target.value)}>
                {CATEGORIES.map((c) => {
                  const inCat = itemsIn(c.key, ALL);
                  if (!inCat.length) return null;
                  const done = inCat.filter((i) => queue.attempted.includes(i.id)).length;
                  return (
                    <option key={c.key} value={c.key}>
                      {c.label} · {done}/{inCat.length} done
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted">
              Subcategory
              <select
                className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-60`}
                value={group}
                onChange={(e) => chooseGroup(e.target.value)}
                disabled={groups.length < 2}
              >
                <option value={ALL}>All ({itemsIn(activeCat, ALL).length})</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g} ({itemsIn(activeCat, g).length})
                  </option>
                ))}
              </select>
            </label>

            <details ref={pickerRef} className="relative sm:col-span-2 lg:col-span-1">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2 rounded-2xl bg-ink px-4 text-sm font-semibold text-white lg:mt-[23px] [&::-webkit-details-marker]:hidden">
                {tickedInScope ? `${tickedInScope} of ${scopeItems.length} questions chosen` : "Choose questions"}
                <ChevronDown size={16} aria-hidden />
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-[min(560px,calc(100vw-40px))] rounded-[24px] bg-white p-3 ring-1 ring-panel">
                <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2">
                  <p className="text-[13px] text-muted">
                    Tick the questions you want to practise. With none ticked, you practise all of them.
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setTicked(Array.from(new Set([...selected, ...scopeItems.map((i) => i.id)])))}
                      className="min-h-[44px] rounded-full px-3 text-sm font-semibold hover:bg-panel"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setTicked(selected.filter((id) => !scopeItems.some((i) => i.id === id)))}
                      className="min-h-[44px] rounded-full px-3 text-sm font-semibold hover:bg-panel"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <ul className="flex max-h-[340px] flex-col overflow-y-auto">
                  {scopeItems.map((it) => (
                    <li key={it.id}>
                      <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 text-sm hover:bg-ground">
                        <input
                          type="checkbox"
                          checked={selected.includes(it.id)}
                          onChange={() => toggleTick(it.id)}
                          className="h-5 w-5 flex-none accent-ink"
                        />
                        {/* Full question text here, since this is where you choose; concepts and cases use their name. */}
                        <span className="min-w-0 flex-1">{it.type === "concept" || it.type === "case" ? it.label : it.text}</span>
                        {queue.attempted.includes(it.id) ? (
                          <span className="inline-flex flex-none items-center gap-1 rounded-full bg-mint px-2 py-0.5 text-xs font-semibold">
                            <Check size={12} aria-hidden /> Practised
                          </span>
                        ) : null}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-muted" aria-live="polite">
              {position === -1
                ? `Not in your chosen questions · ${practiceSet.length} to practise`
                : `Question ${position + 1} of ${practiceSet.length}${tickedInScope ? " (your choice)" : ""}`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => prevItem && goTo(prevItem.id)}
                disabled={!prevItem}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-white px-4 text-sm font-semibold transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} aria-hidden /> Previous
              </button>
              <button
                type="button"
                onClick={() => nextItem && goTo(nextItem.id)}
                disabled={!nextItem}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-white px-4 text-sm font-semibold transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          </div>

          <section aria-labelledby="item-h" className="mt-6 flex flex-col gap-4 rounded-[36px] bg-lavender p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2.5 text-[13px] font-medium">
                <IconCircle>
                  <Briefcase size={18} aria-hidden />
                </IconCircle>
                {TYPE_LABEL[current.type] ?? "Practice"}
              </span>
              {current.concepts.length ? <Badge>Uses: {current.concepts.slice(0, 2).join(", ")}</Badge> : null}
            </div>
            <h2 id="item-h" className="text-[26px] font-normal leading-snug tracking-[-0.01em] md:text-[32px]">
              {current.text}
            </h2>
            {current.hint ? (
              <details className="rounded-[20px] bg-white/70 px-4">
                <summary className="flex min-h-[48px] cursor-pointer items-center text-sm font-semibold">Show a hint</summary>
                <p className="pb-4 text-sm">{current.hint}</p>
              </details>
            ) : null}
          </section>

          {/* Voice dictation */}
          {dict.listening ? (
            <section
              aria-label="Recording"
              className="mt-5 flex flex-wrap items-center gap-4 rounded-full bg-ink p-3.5 text-white"
            >
              <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-pink text-ink">
                <Mic size={22} aria-hidden />
              </span>
              <div className="min-w-0 flex-[1_1_200px]">
                <p className="text-sm font-semibold">Listening… speak your answer</p>
                <p className="text-[13px] text-[#D8D2CC]">Recording {mmss(dict.seconds)} · your words appear below</p>
              </div>
              <div aria-hidden className="flex h-9 flex-[1_1_120px] items-center gap-1">
                {[12, 24, 34, 18, 28, 14, 30, 20, 10, 26].map((h, i) => (
                  <span
                    key={i}
                    className={`skeleton w-[5px] rounded ${["bg-peach", "bg-pink", "bg-lavender", "bg-mint"][i % 4]}`}
                    style={{ height: h, animationDelay: `${i * 90}ms` }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={dict.stop}
                className="inline-flex min-h-[48px] flex-none items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-ink"
              >
                <Square size={14} aria-hidden /> Stop
              </button>
            </section>
          ) : (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <SecondaryButton
                onClick={() => {
                  setUsedVoice(true);
                  dict.start(answer);
                }}
                disabled={!dict.supported}
                className="min-h-[52px] bg-ink! px-6 text-white! hover:bg-black!"
              >
                <Mic size={18} aria-hidden /> Speak your answer
              </SecondaryButton>
              <span className="text-[13px] text-muted">
                {dict.supported
                  ? "Uses your browser's speech recognition (best in Chrome or Edge). You can also just type."
                  : "Voice input isn't supported in this browser. Use Chrome or Edge, or type your answer."}
              </span>
            </div>
          )}
          {dict.error ? (
            <div className="mt-3">
              <ErrorBox message={dict.error} />
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="answer" className="text-sm font-semibold">
                Your answer{usedVoice ? " · transcript" : ""}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={undo}
                  disabled={!text.canUndo}
                  title="Undo the last phrase or edit (Ctrl+Z)"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-ink transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Undo2 size={16} aria-hidden /> Undo
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={!text.canRedo}
                  title="Redo (Ctrl+Y)"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-ink transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Redo2 size={16} aria-hidden /> Redo
                </button>
              </div>
            </div>
            {usedVoice ? <span className="text-[13px] text-muted">Edit anything the mic got wrong before scoring. Undo removes the last phrase.</span> : null}
            <textarea
              id="answer"
              rows={9}
              className={`${fieldInput} rounded-[28px] bg-white! p-4.5`}
              value={answer}
              onChange={(e) => setAnswer(e.target.value, "type")}
              onKeyDown={(e) => {
                // Use the same history as the buttons (the browser's own undo can't see spoken text).
                if (!(e.ctrlKey || e.metaKey)) return;
                const k = e.key.toLowerCase();
                if (k === "z" && !e.shiftKey) {
                  e.preventDefault();
                  undo();
                } else if (k === "y" || (k === "z" && e.shiftKey)) {
                  e.preventDefault();
                  redo();
                }
              }}
              placeholder="Type your answer, or press “Speak your answer”."
            />
          </div>
          {scoreError ? (
            <div className="mt-3">
              <ErrorBox message={scoreError} />
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <PrimaryButton onClick={score} disabled={scoring || answer.trim().length < 20} className="min-h-[52px]">
              {scoring ? "Scoring…" : "Score my answer"}
            </PrimaryButton>
            {result ? (
              <>
                <SecondaryButton
                  onClick={() => {
                    setResult(null);
                    document.getElementById("answer")?.focus();
                  }}
                  className="min-h-[52px] bg-panel"
                >
                  Revise and retry
                </SecondaryButton>
                <SecondaryButton onClick={seeModelAnswer} className="min-h-[52px] bg-panel" aria-expanded={showModel}>
                  <Sparkles size={16} aria-hidden />
                  {model?.state === "loading" && showModel
                    ? "Writing model answer…"
                    : showModel && model?.state === "done"
                      ? "Hide model answer"
                      : "See model answer"}
                </SecondaryButton>
              </>
            ) : null}
          </div>

          {result ? (
            <section
              ref={feedbackRef}
              aria-labelledby="feedback-h"
              className="mt-8 flex scroll-mt-6 flex-col gap-6 rounded-[36px] bg-white p-6 md:p-8"
            >
              <div>
                <p className="text-[13px] font-semibold text-muted">
                  Feedback · overall{" "}
                  {SCORE_LABELS.reduce((sum, [k]) => sum + result.scores[k], 0)}/{SCORE_LABELS.length * 5}
                </p>
                <h2 id="feedback-h" className="mt-1.5 text-[28px] font-medium leading-tight tracking-[-0.01em]">
                  {result.headline}
                </h2>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {SCORE_LABELS.map(([k, label], idx) => (
                  <div key={k} className={`flex flex-col gap-2.5 rounded-[24px] p-4 ${SCORE_COLORS[idx]}`}>
                    <dt className="text-sm font-semibold">{label}</dt>
                    <dd className="text-[32px] font-medium leading-none">
                      {result.scores[k]}
                      <span className="text-[15px] font-normal">/5</span>
                    </dd>
                    <dd aria-hidden className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={`h-2 flex-1 rounded-full ${n <= result.scores[k] ? "bg-ink" : "bg-white/70"}`} />
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>

              {result.concepts_used.length + result.concepts_missed.length > 0 ? (
                <div>
                  <h3 className="mb-2.5 text-[17px] font-medium">Concepts</h3>
                  <ul className="flex flex-wrap gap-2 text-[13px] font-semibold">
                    {result.concepts_used.map((c) => (
                      <li key={"u" + c} className="rounded-full bg-mint px-3 py-1.5">
                        Used: {c}
                      </li>
                    ))}
                    {result.concepts_missed.map((c) => (
                      <li key={"m" + c} className="rounded-full bg-pink px-3 py-1.5">
                        Missed: {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <h3 className="mb-2.5 text-[17px] font-medium">How to make it stronger</h3>
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-relaxed">
                  {result.stronger_answer.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>

              {nextItem ? (
                <div>
                  <PrimaryButton onClick={() => goTo(nextItem.id)}>Next question →</PrimaryButton>
                </div>
              ) : null}
            </section>
          ) : null}

          {result && showModel ? (
            <section
              ref={modelRef}
              aria-labelledby="model-h"
              className="mt-6 flex scroll-mt-6 flex-col gap-5 rounded-[36px] bg-mint p-6 md:p-8"
            >
              <div>
                <p className="text-[13px] font-semibold">
                  Model answer{model?.data?.structure ? ` · ${model.data.structure}` : ""}
                </p>
                <h2 id="model-h" className="mt-1.5 text-[28px] font-medium leading-tight tracking-[-0.01em]">
                  How you could answer it
                </h2>
              </div>
              {model?.state === "loading" ? (
                <Spinner label="Writing a model answer from your resume…" />
              ) : model?.state === "error" ? (
                <ErrorBox
                  message={model.error ?? "Could not write the model answer."}
                  onRetry={() => {
                    setModel(null);
                    void seeModelAnswer();
                  }}
                />
              ) : model?.data ? (
                <>
                  <dl className="flex flex-col gap-3">
                    {model.data.sections.map((sec, i) => (
                      <div key={i} className="rounded-[20px] bg-white p-4">
                        <dt className="text-xs font-bold uppercase tracking-wide text-muted">{sec.label}</dt>
                        <dd className="mt-1 text-[16px] leading-relaxed">{sec.text}</dd>
                      </div>
                    ))}
                  </dl>
                  {model.data.why_it_works.length ? (
                    <div>
                      <h3 className="mb-2 text-[17px] font-medium">Why it works</h3>
                      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px]">
                        {model.data.why_it_works.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="text-[13px] font-semibold">
                    {model.data.sources.length
                      ? `Built from your resume: ${model.data.sources.join(" · ")}`
                      : "No direct resume line used."}
                    {model.data.placeholders.length
                      ? ` Replace the placeholders with your real details: ${model.data.placeholders.join(", ")}.`
                      : ""}
                  </p>
                </>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="p-10"><Spinner label="Loading…" /></div>}>
      <PracticeInner />
    </Suspense>
  );
}
