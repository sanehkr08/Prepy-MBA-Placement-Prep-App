"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Lightbulb, CircleHelp, Briefcase, Flag, Star, User, Plus, BookOpenText, X } from "lucide-react";
import { api, rememberJD } from "@/lib/client";
import type { Concepts, Questions, Cases, Situational, ConceptNotes } from "@/lib/schemas";
import { useProfile } from "@/components/hooks";
import {
  AppShell,
  PageTitle,
  ProfileBadge,
  PanelCard,
  PillChip,
  IconCircle,
  Badge,
  SkeletonCards,
  ErrorBox,
  SecondaryButton,
  Spinner,
  primaryLink,
} from "@/components/ui";

type Tab = "concepts" | "questions" | "cases" | "situational" | "behavioral" | "resume";
const TAB_SECTION: Record<Tab, "concepts" | "questions" | "cases" | "situational"> = {
  concepts: "concepts",
  questions: "questions",
  cases: "cases",
  situational: "situational",
  behavioral: "situational",
  resume: "questions",
};
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "concepts", label: "Concepts", icon: <Lightbulb size={18} /> },
  { key: "questions", label: "Questions", icon: <CircleHelp size={18} /> },
  { key: "cases", label: "Cases", icon: <Briefcase size={18} /> },
  { key: "situational", label: "Situational", icon: <Flag size={18} /> },
  { key: "behavioral", label: "Behavioral", icon: <Star size={18} /> },
  { key: "resume", label: "Resume and gaps", icon: <User size={18} /> },
];
const TOPIC_BG = ["bg-pink", "bg-peach", "bg-lavender", "bg-mint", "bg-white"];
const MORE_NOUN: Record<Tab, string> = {
  concepts: "concepts",
  questions: "questions",
  cases: "cases",
  situational: "situational questions",
  behavioral: "behavioral questions",
  resume: "resume and gap questions",
};

type JDInfo = { id: string; company: string; role: string; role_family: string };
type SectionData = { concepts?: Concepts; questions?: Questions; cases?: Cases; situational?: Situational };

type OutlineView = {
  situation: string;
  task: string;
  action: string;
  result: string;
  placeholders: string[];
  gap_framing: string;
  sources: { ref: string; label: string | null; text: string }[];
};

function OutlineButton({ jdId, question }: { jdId: string; question: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [outline, setOutline] = useState<OutlineView | null>(null);
  const [err, setErr] = useState("");
  async function go() {
    setState("loading");
    try {
      const r = await api<{ outline: OutlineView }>(`/api/kit/${jdId}/outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      setOutline(r.outline);
      setState("done");
    } catch (e) {
      setErr((e as Error).message);
      setState("error");
    }
  }
  if (state === "idle")
    return (
      <SecondaryButton onClick={go} className="self-start">
        Build my answer outline
      </SecondaryButton>
    );
  if (state === "loading") return <Spinner label="Building from your resume…" />;
  if (state === "error") return <ErrorBox message={err} onRetry={go} />;
  return outline ? (
    <div className="rounded-[20px] bg-white p-4 text-sm">
      <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2">
        {(["situation", "task", "action", "result"] as const).map((k) => (
          <div key={k} className="contents">
            <dt className="font-semibold capitalize">{k}</dt>
            <dd>{outline[k]}</dd>
          </div>
        ))}
      </dl>
      {outline.gap_framing ? <p className="mt-3 rounded-2xl bg-peach px-3 py-2">{outline.gap_framing}</p> : null}
      {outline.sources.length ? (
        <p className="mt-3 text-xs font-semibold text-muted">
          From your resume: {outline.sources.map((s) => s.label ?? s.ref).join(" · ")}
        </p>
      ) : (
        <p className="mt-3 text-xs font-semibold text-muted">No direct resume line: fill in the placeholders.</p>
      )}
      {outline.placeholders.length ? (
        <p className="mt-1 text-xs text-muted">Fill in: {outline.placeholders.join(", ")}</p>
      ) : null}
    </div>
  ) : null;
}

// Code and formulas get a monospace box; worked examples in plain words read better as text.
const looksLikeCode = (t: string) =>
  /[;{}]|(SELECT|FROM|WHERE|JOIN|GROUP BY)|=\s*[A-Z]+\(|[A-Za-z_]+\([^)]*\)\s*(=|$)|^\s*[A-Za-z ]+\s=\s/m.test(t);

/** "Read more": full study notes for one concept, in a dialog over the page. */
function ConceptNotesDialog({
  jdId,
  topicIdx,
  itemIdx,
  name,
  topic,
  onClose,
}: {
  jdId: string;
  topicIdx: number;
  itemIdx: number;
  name: string;
  topic: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [notes, setNotes] = useState<ConceptNotes | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setErr("");
    api<{ notes: ConceptNotes }>(`/api/kit/${jdId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topicIdx, item: itemIdx }),
    })
      .then((r) => setNotes(r.notes))
      .catch((e: Error) => setErr(e.message));
  }, [jdId, topicIdx, itemIdx]);

  useEffect(() => {
    ref.current?.showModal();
    void Promise.resolve().then(load);
  }, [load]);

  const h3 = "mb-2.5 text-[17px] font-medium";
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop (the dialog element itself) closes it.
        if (e.target === ref.current) ref.current?.close();
      }}
      aria-labelledby="notes-h"
      className="m-auto max-h-[88vh] w-[min(780px,calc(100vw-32px))] overflow-y-auto rounded-[32px] bg-ground p-0 text-ink backdrop:bg-ink/40"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-ground px-6 pb-3 pt-6 md:px-8">
        <div>
          <p className="text-[13px] font-semibold text-muted">Study notes · {topic}</p>
          <h2 id="notes-h" className="mt-1 text-[30px] font-medium leading-tight tracking-[-0.01em]">
            {name}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="inline-flex min-h-[44px] flex-none items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold hover:bg-panel"
        >
          <X size={16} aria-hidden /> Close
        </button>
      </div>

      <div className="flex flex-col gap-6 px-6 pb-8 md:px-8">
        {err ? (
          <ErrorBox message={err} onRetry={load} />
        ) : !notes ? (
          <Spinner label="Writing your study notes… (only the first time)" />
        ) : (
          <>
            <p className="text-[16px] leading-relaxed">{notes.overview}</p>

            <section>
              <h3 className={h3}>Key topics</h3>
              <div className="flex flex-col gap-3">
                {notes.key_points.map((k, i) => (
                  <article key={i} className="rounded-[20px] bg-white p-4">
                    <h4 className="text-[16px] font-semibold">{k.title}</h4>
                    <p className="mt-1 text-[15px]">{k.explanation}</p>
                    {k.example ? (
                      looksLikeCode(k.example) ? (
                        <pre className="mt-2.5 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-panel px-3.5 py-2.5 font-mono text-[13px]">
                          {k.example}
                        </pre>
                      ) : (
                        <p className="mt-2.5 rounded-2xl bg-panel px-3.5 py-2.5 text-sm">
                          <strong className="font-semibold">Example:</strong> {k.example}
                        </p>
                      )
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            {notes.in_this_role ? (
              <section className="rounded-[24px] bg-lavender p-5">
                <h3 className={h3}>How it is used in this role</h3>
                <p className="text-[15px]">{notes.in_this_role}</p>
              </section>
            ) : null}

            {notes.common_mistakes.length ? (
              <section className="rounded-[24px] bg-pink p-5">
                <h3 className={h3}>Common mistakes</h3>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px]">
                  {notes.common_mistakes.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {notes.interview_questions.length ? (
              <section>
                <h3 className={h3}>Questions you may be asked</h3>
                <ol className="flex flex-col gap-3">
                  {notes.interview_questions.map((q, i) => (
                    <li key={i} className="rounded-[20px] bg-white p-4">
                      <p className="text-[15px] font-semibold">{q.question}</p>
                      <p className="mt-1 text-sm text-muted">{q.how_to_answer}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {notes.checklist.length ? (
              <section className="rounded-[24px] bg-mint p-5">
                <h3 className={h3}>Quick revision checklist</h3>
                <ul className="flex flex-col gap-1.5 text-[15px]">
                  {notes.checklist.map((c, i) => (
                    <li key={i}>· {c}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </dialog>
  );
}

export default function KitPage() {
  const { jdId } = useParams<{ jdId: string }>();
  const { profile } = useProfile();
  const [tab, setTab] = useState<Tab>("concepts");
  const [jd, setJd] = useState<JDInfo | null>(null);
  const [sections, setSections] = useState<SectionData>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ items: { id: string; text: string }[]; done: string[] }>({ items: [], done: [] });
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [more, setMore] = useState<{
    tab: Tab;
    topic?: string;
    state: "loading" | "done" | "error";
    message: string;
  } | null>(null);
  const [reading, setReading] = useState<{ ti: number; ci: number } | null>(null);

  const loadSection = useCallback(
    async (section: "concepts" | "questions" | "cases" | "situational") => {
      setError(null);
      setLoading(section);
      try {
        const r = await api<{ jd: JDInfo; data: unknown }>(`/api/kit/${jdId}/${section}`);
        setJd(r.jd);
        setSections((s) => ({ ...s, [section]: r.data }));
        const p = await api<typeof plan>(`/api/kit/${jdId}/plan`);
        setPlan(p);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(null);
      }
    },
    [jdId],
  );

  useEffect(() => {
    rememberJD(jdId);
  }, [jdId]);

  const section = TAB_SECTION[tab];
  const have = !!sections[section];
  useEffect(() => {
    if (!have && !error) void Promise.resolve().then(() => loadSection(section));
  }, [section, have, error, loadSection]);

  /** `topic`: add concepts to one concept topic only. */
  async function generateMore(topic?: string) {
    const forTab = tab;
    setMore({ tab: forTab, topic, state: "loading", message: "" });
    try {
      const r = await api<{ data: unknown; added: number }>(`/api/kit/${jdId}/more`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: forTab, topic }),
      });
      setSections((s) => ({ ...s, [TAB_SECTION[forTab]]: r.data }));
      setMore({
        tab: forTab,
        topic,
        state: "done",
        message: r.added
          ? `Added ${r.added} new ${MORE_NOUN[forTab]}${topic ? " to this topic" : " at the end"}.`
          : `No new ${MORE_NOUN[forTab]} this time. Try again.`,
      });
      setPlan(await api<typeof plan>(`/api/kit/${jdId}/plan`));
    } catch (e) {
      setMore({ tab: forTab, topic, state: "error", message: (e as Error).message });
    }
  }

  /** The Generate More button with its loading, result and error states. */
  function moreControls(topic?: string) {
    const mine = more?.tab === tab && more.topic === topic ? more : null;
    return (
      <div className="flex flex-col items-start gap-3" aria-live="polite">
        {mine?.state === "loading" ? (
          <Spinner label={`Generating more ${MORE_NOUN[tab]}…`} />
        ) : (
          <SecondaryButton onClick={() => generateMore(topic)} disabled={more?.state === "loading"}>
            <Plus size={16} aria-hidden /> Generate More
          </SecondaryButton>
        )}
        {mine?.state === "done" ? <p className="text-sm text-muted">{mine.message}</p> : null}
        {mine?.state === "error" ? <ErrorBox message={mine.message} onRetry={() => generateMore(topic)} /> : null}
      </div>
    );
  }

  async function togglePlan(id: string) {
    const done = plan.done.includes(id) ? plan.done.filter((d) => d !== id) : [...plan.done, id];
    setPlan((p) => ({ ...p, done }));
    await api(`/api/kit/${jdId}/plan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    }).catch(() => undefined);
  }

  const panel = (
    <>
      <ProfileBadge name={profile?.data.name} headline={profile?.data.headline} />
      <PanelCard
        title={
          <span className="flex items-center justify-between">
            Study plan
            {plan.items.length ? (
              <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-bold text-ink">
                {plan.done.filter((d) => plan.items.some((i) => i.id === d)).length} of {plan.items.length} done
              </span>
            ) : null}
          </span>
        }
      >
        {plan.items.length === 0 ? (
          <p className="text-sm">Your plan appears once the concepts are ready.</p>
        ) : (
          <ul className="flex flex-col">
            {plan.items.map((p) => (
              <li key={p.id} className="flex min-h-[48px] items-center gap-3">
                <input
                  id={p.id}
                  type="checkbox"
                  checked={plan.done.includes(p.id)}
                  onChange={() => togglePlan(p.id)}
                  className="h-5 w-5 flex-none accent-ink"
                />
                <label htmlFor={p.id} className="text-sm">
                  {p.text}
                </label>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
      <Link href={`/practice/${jdId}`} className={primaryLink}>
        Start practising →
      </Link>
    </>
  );

  const concepts = sections.concepts;
  const questions = sections.questions?.questions ?? [];
  const cases = sections.cases?.cases ?? [];
  const sit = sections.situational;

  return (
    <AppShell active="kit" jdId={jdId} panel={panel}>
      {reading && concepts?.topics[reading.ti]?.items[reading.ci] ? (
        <ConceptNotesDialog
          jdId={jdId}
          topicIdx={reading.ti}
          itemIdx={reading.ci}
          name={concepts.topics[reading.ti].items[reading.ci].name}
          topic={concepts.topics[reading.ti].name}
          onClose={() => setReading(null)}
        />
      ) : null}
      <PageTitle eyebrow={`Step 4 of 5${jd ? ` · ${jd.role}${jd.company ? ` · ${jd.company}` : ""}` : ""}`}>
        Everything this
        <br />
        role needs you to know
      </PageTitle>

      <div className="mt-7 flex gap-3 overflow-x-auto pb-1" role="tablist" aria-label="Kit sections">
        {TABS.map((t) => (
          <PillChip key={t.key} active={tab === t.key} icon={t.icon} onClick={() => setTab(t.key)}>
            {t.label}
          </PillChip>
        ))}
      </div>

      <div className="mt-7">
        {error ? (
          <ErrorBox message={error} onRetry={() => loadSection(section)} />
        ) : !have || loading === section ? (
          <SkeletonCards count={6} label="Building this part of your prep kit…" />
        ) : (
          <>

            {tab === "concepts" && concepts ? (
              <div className="flex flex-col gap-7">
                {concepts.topics.map((t, ti) => (
                  <section key={ti}>
                    <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-[22px] font-medium">{t.name}</h2>
                      <span className="text-[13px] font-semibold text-muted">{t.note}</span>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                      {t.items.map((c, ci) => (
                        <article key={ci} className={`flex flex-col gap-2.5 rounded-[28px] p-5 ${TOPIC_BG[ti % TOPIC_BG.length]}`}>
                          <div className="flex items-center justify-between gap-2">
                            <IconCircle>
                              <Lightbulb size={18} strokeWidth={1.7} aria-hidden />
                            </IconCircle>
                            <Badge>{c.priority} priority</Badge>
                          </div>
                          <h3 className="mt-1 text-[21px] font-medium leading-tight tracking-[-0.01em]">{c.name}</h3>
                          <p className="text-sm">{c.what}</p>
                          <p className="rounded-2xl bg-white/70 px-3.5 py-2.5 text-[13px]">
                            <strong className="font-semibold">Why it matters:</strong> {c.why_it_matters}
                          </p>
                          <button
                            type="button"
                            onClick={() => setReading({ ti, ci })}
                            className="mt-auto inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-full bg-white px-4 text-[13px] font-semibold hover:bg-white/70"
                          >
                            <BookOpenText size={15} aria-hidden /> Read more
                          </button>
                        </article>
                      ))}
                    </div>
                    <div className="mt-4">{moreControls(t.name)}</div>
                  </section>
                ))}
              </div>
            ) : null}

            {tab === "questions" ? (
              <ol className="flex flex-col gap-3">
                {questions
                  .map((q, i) => ({ q, i }))
                  .filter(({ q }) => q.category === "role_knowledge" || q.category === "technical")
                  .map(({ q, i }) => (
                    <li key={i} className="flex flex-col gap-2 rounded-[24px] bg-white p-5">
                      <span className="text-xs font-bold uppercase tracking-wide text-muted">
                        {q.category === "technical" ? "Technical" : "Role knowledge"}
                        {q.linked_concepts.length ? ` · ${q.linked_concepts.join(", ")}` : ""}
                      </span>
                      <p className="text-[17px]">{q.text}</p>
                      <Link href={`/practice/${jdId}?item=q-${i}`} className="inline-flex min-h-[44px] items-center self-start text-[13px] font-semibold">
                        Practise this →
                      </Link>
                    </li>
                  ))}
              </ol>
            ) : null}

            {tab === "cases" ? (
              <div className="flex flex-col gap-5">
                {cases.map((c, i) => (
                  <article key={i} className="flex flex-col gap-3 rounded-[32px] bg-lavender p-6">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2.5 text-[13px] font-medium">
                        <IconCircle>
                          <Briefcase size={18} aria-hidden />
                        </IconCircle>
                        Case {i + 1}
                      </span>
                      {c.linked_concepts.length ? <Badge>Uses: {c.linked_concepts.slice(0, 2).join(", ")}</Badge> : null}
                    </div>
                    <h3 className="text-2xl font-medium">{c.title}</h3>
                    <p className="text-[16px]">{c.prompt}</p>
                    <details className="rounded-[20px] bg-white/70 px-4">
                      <summary className="flex min-h-[48px] cursor-pointer items-center text-sm font-semibold">Show a framework hint</summary>
                      <p className="pb-4 text-sm">{c.framework}</p>
                    </details>
                    {revealed[i] ? (
                      <div className="rounded-[20px] bg-white p-4">
                        <p className="mb-2 text-sm font-semibold">Solution outline</p>
                        <ol className="list-decimal pl-5 text-sm">
                          {c.solution_outline.map((s, k) => (
                            <li key={k} className="mb-1">
                              {s}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-3">
                      <Link href={`/practice/${jdId}?item=case-${i}`} className={primaryLink}>
                        Solve it in practice →
                      </Link>
                      {!revealed[i] ? (
                        <SecondaryButton onClick={() => setRevealed((r) => ({ ...r, [i]: true }))}>
                          I&apos;ve attempted it: show solution
                        </SecondaryButton>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {tab === "situational" && sit ? (
              <ol className="flex flex-col gap-3">
                {sit.situational.map((s, i) => (
                  <li key={i} className="flex flex-col gap-2 rounded-[24px] bg-peach p-5">
                    {s.competency ? <span className="text-xs font-bold uppercase tracking-wide">{s.competency}</span> : null}
                    <p className="text-[17px]">{s.text}</p>
                    <Link href={`/practice/${jdId}?item=s-${i}`} className="inline-flex min-h-[44px] items-center self-start text-[13px] font-semibold">
                      Practise this →
                    </Link>
                  </li>
                ))}
              </ol>
            ) : null}

            {tab === "behavioral" && sit ? (
              <ol className="flex flex-col gap-3">
                {sit.behavioral.map((s, i) => (
                  <li key={i} className="flex flex-col gap-3 rounded-[24px] bg-mint p-5">
                    {s.competency ? <span className="text-xs font-bold uppercase tracking-wide">{s.competency}</span> : null}
                    <p className="text-[17px]">{s.text}</p>
                    <OutlineButton jdId={jdId} question={s.text} />
                    <Link href={`/practice/${jdId}?item=b-${i}`} className="inline-flex min-h-[44px] items-center self-start text-[13px] font-semibold">
                      Practise this →
                    </Link>
                  </li>
                ))}
              </ol>
            ) : null}

            {tab === "resume" ? (
              <ol className="flex flex-col gap-3">
                {questions
                  .map((q, i) => ({ q, i }))
                  .filter(({ q }) => q.category === "resume" || q.category === "gap")
                  .map(({ q, i }) => (
                    <li key={i} className={`flex flex-col gap-3 rounded-[24px] p-5 ${q.category === "gap" ? "bg-pink" : "bg-white"}`}>
                      <span className="text-xs font-bold uppercase tracking-wide">{q.category === "gap" ? "Gap question" : "Resume question"}</span>
                      <p className="text-[17px]">{q.text}</p>
                      <OutlineButton jdId={jdId} question={q.text} />
                      <Link href={`/practice/${jdId}?item=q-${i}`} className="inline-flex min-h-[44px] items-center self-start text-[13px] font-semibold">
                        Practise this →
                      </Link>
                    </li>
                  ))}
              </ol>
            ) : null}

            {tab !== "concepts" ? <div className="mt-6">{moreControls()}</div> : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
