"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Check, Mic, Square, Undo2, Redo2, Lightbulb, CircleHelp, Flag, Star, User } from "lucide-react";
import { api, rememberJD } from "@/lib/client";
import type { PracticeScore } from "@/lib/schemas";
import { useDictation, useUndoableText } from "@/components/hooks";
import {
  AppShell,
  PageTitle,
  PanelCard,
  IconCircle,
  Badge,
  PillChip,
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
const CATEGORIES: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: "concepts", label: "Concepts", icon: <Lightbulb size={18} /> },
  { key: "questions", label: "Questions", icon: <CircleHelp size={18} /> },
  { key: "cases", label: "Cases", icon: <Briefcase size={18} /> },
  { key: "situational", label: "Situational", icon: <Flag size={18} /> },
  { key: "behavioral", label: "Behavioral", icon: <Star size={18} /> },
  { key: "resume", label: "Resume and gaps", icon: <User size={18} /> },
];
const ALL = "All";
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
  // Reset the answer when the item changes.
  const [shownId, setShownId] = useState<string | null>(null);
  if (current && current.id !== shownId) {
    setShownId(current.id);
    // Show the opened question's category; keep "All" unless another subcategory was picked.
    if (current.category !== cat) {
      setCat(current.category);
      // A link to one question (from the prep kit) opens its subcategory; otherwise show all.
      setGroup((currentId && current.group) || ALL);
    } else if (group !== ALL && group !== current.group) setGroup(current.group || ALL);
    resetAnswer("");
    setResult(null);
    setScoreError(null);
    setUsedVoice(false);
  }

  // Keep the selected category chip visible in the scrolling row.
  useEffect(() => {
    document
      .querySelector('nav[aria-label="Practice categories"] [aria-pressed="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [cat]);

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
      setQueue((q) => (q ? { ...q, attempted: Array.from(new Set([...q.attempted, current.id])) } : q));
    } catch (e) {
      setScoreError((e as Error).message);
    } finally {
      setScoring(false);
    }
  }

  const activeCat = cat ?? current?.category ?? "concepts";
  const catItems = useMemo(() => queue?.items.filter((i) => i.category === activeCat) ?? [], [queue, activeCat]);
  const groups = useMemo(() => Array.from(new Set(catItems.map((i) => i.group).filter(Boolean))), [catItems]);
  const listItems = group === ALL ? catItems : catItems.filter((i) => i.group === group);

  // Next: the next question in this subcategory, then in this category, then anywhere after.
  const nextItem = useMemo(() => {
    if (!queue || !current) return null;
    const after = (list: Item[]) => {
      const idx = list.findIndex((i) => i.id === current.id);
      return idx === -1 ? null : list[idx + 1] ?? null;
    };
    return after(listItems) ?? after(catItems) ?? after(queue.items);
  }, [queue, current, listItems, catItems]);

  const panel = result ? (
    <>
      <div>
        <p className="text-[13px] font-medium text-muted">Feedback</p>
        <h2 className="mt-1 text-[26px] font-medium leading-tight">{result.headline}</h2>
      </div>
      <PanelCard>
        <dl className="flex flex-col gap-3.5">
          {SCORE_LABELS.map(([k, label], idx) => (
            <div key={k} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-2">
                <dt className="text-sm">{label}</dt>
                <dd className="text-sm font-bold">{result.scores[k]}/5</dd>
              </div>
              <dd aria-hidden className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={`h-2.5 flex-1 rounded-full ${n <= result.scores[k] ? SCORE_COLORS[idx] : "bg-panel"}`} />
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </PanelCard>
      {result.concepts_used.length + result.concepts_missed.length > 0 ? (
        <PanelCard title="Concepts">
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
        </PanelCard>
      ) : null}
      <PanelCard title="A stronger answer">
        <ol className="list-decimal pl-5 text-sm">
          {result.stronger_answer.map((s, i) => (
            <li key={i} className="mb-1.5">
              {s}
            </li>
          ))}
        </ol>
      </PanelCard>
      {nextItem ? (
        <PrimaryButton onClick={() => goTo(nextItem.id)}>Next: {TYPE_LABEL[nextItem.type] ?? "item"} →</PrimaryButton>
      ) : null}
    </>
  ) : (
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
          <nav aria-label="Practice categories" className="mt-6 flex gap-3 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => {
              const inCat = queue.items.filter((i) => i.category === c.key);
              const done = inCat.filter((i) => queue.attempted.includes(i.id)).length;
              if (!inCat.length) return null;
              return (
                <PillChip
                  key={c.key}
                  active={activeCat === c.key}
                  icon={c.icon}
                  onClick={() => {
                    setCat(c.key);
                    setGroup(ALL);
                  }}
                >
                  {c.label}
                  <span className="font-normal opacity-75">
                    {done}/{inCat.length}
                  </span>
                </PillChip>
              );
            })}
          </nav>

          {groups.length > 1 ? (
            <div role="group" aria-label="Subcategories" className="mt-4 flex flex-wrap gap-2">
              {[ALL, ...groups].map((g) => {
                const n = g === ALL ? catItems.length : catItems.filter((i) => i.group === g).length;
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={group === g}
                    onClick={() => setGroup(g)}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${
                      group === g ? "bg-ink text-white" : "bg-white text-ink hover:bg-panel"
                    }`}
                  >
                    {g}
                    <span className="font-normal opacity-75">{n}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <ol aria-label="Questions" className="mt-4 flex max-h-[340px] flex-col gap-2 overflow-y-auto pr-1">
            {listItems.map((it) => {
              const active = it.id === current.id;
              const done = queue.attempted.includes(it.id);
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => goTo(it.id)}
                    aria-current={active ? "true" : undefined}
                    className={`flex min-h-[48px] w-full items-center gap-3 rounded-[20px] px-4 py-2.5 text-left text-sm transition ${
                      active ? "bg-ink text-white" : "bg-white text-ink hover:bg-panel"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${
                        done ? "bg-mint text-ink" : active ? "bg-white/20" : "bg-panel"
                      }`}
                    >
                      {done ? <Check size={14} aria-label="practised" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">{it.label}</span>
                    {group === ALL && it.group && groups.length > 1 ? (
                      <span className={`hidden flex-none text-xs sm:inline ${active ? "text-white/75" : "text-muted"}`}>{it.group}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>

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
              <SecondaryButton onClick={() => setResult(null)} className="min-h-[52px] bg-panel">
                Revise and retry
              </SecondaryButton>
            ) : null}
          </div>
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
