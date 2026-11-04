"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/client";
import type { MockScore } from "@/lib/schemas";
import { ErrorBox, SecondaryButton, Spinner, primaryLink } from "@/components/ui";

export type MockQuestionView = {
  item_id: string;
  type: string;
  label: string;
  text: string;
  followup_eligible: boolean;
  answer: string;
  followup: string;
  followup_answer: string;
};
export type MockView = {
  id: string;
  created_at: string;
  finished: boolean;
  jd: { id: string; kind: "jd" | "role"; company: string; role: string };
  length: number;
  seconds_per_question: number;
  questions: MockQuestionView[];
  result: MockScore | null;
};

const SCORES: [keyof MockScore["questions"][number]["scores"], string][] = [
  ["structure", "Structure"],
  ["relevance", "Relevance"],
  ["evidence_or_concepts", "Evidence"],
  ["clarity", "Clarity"],
];
const VERDICT_BG: Record<string, string> = {
  "Strong hire signal": "bg-mint",
  "Likely to advance": "bg-mint",
  Borderline: "bg-peach",
  "Needs more practice": "bg-pink",
};

type ModelView = { structure: string; sections: { label: string; text: string }[]; placeholders: string[]; sources: string[] };

/** "See model answer" for one question, from the same endpoint as Practice. */
function ModelAnswer({ jdId, itemId }: { jdId: string; itemId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [model, setModel] = useState<ModelView | null>(null);
  const [err, setErr] = useState("");
  async function load() {
    setState("loading");
    try {
      const r = await api<{ model: ModelView }>("/api/practice/model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdId, itemId }),
      });
      setModel(r.model);
      setState("done");
    } catch (e) {
      setErr((e as Error).message);
      setState("error");
    }
  }
  if (state === "idle")
    return (
      <SecondaryButton onClick={load} className="self-start bg-panel">
        <Sparkles size={16} aria-hidden /> See model answer
      </SecondaryButton>
    );
  if (state === "loading") return <Spinner label="Writing a model answer from your resume…" />;
  if (state === "error") return <ErrorBox message={err} onRetry={load} />;
  return model ? (
    <div className="flex flex-col gap-2.5 rounded-[20px] bg-mint p-4">
      <p className="text-[13px] font-semibold">Model answer{model.structure ? ` · ${model.structure}` : ""}</p>
      <dl className="flex flex-col gap-2">
        {model.sections.map((s, i) => (
          <div key={i}>
            <dt className="text-xs font-bold uppercase tracking-wide text-muted">{s.label}</dt>
            <dd className="text-[15px] leading-relaxed">{s.text}</dd>
          </div>
        ))}
      </dl>
      {model.placeholders.length ? (
        <p className="text-[13px]">Replace the placeholders with your real details: {model.placeholders.join(", ")}.</p>
      ) : null}
    </div>
  ) : null;
}

/** The end-of-interview scorecard. */
export function Scorecard({ mock }: { mock: MockView }) {
  const r = mock.result!;
  const answered = mock.questions.filter((q) => q.answer.trim()).length;
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-5">
      <p className="text-sm font-medium text-muted">
        Mock interview · {mock.jd.role}
        {mock.jd.company ? ` · ${mock.jd.company}` : ""} · {new Date(mock.created_at).toLocaleDateString()}
      </p>

      <section aria-labelledby="sc-h" className="flex flex-wrap items-center gap-6 rounded-[36px] bg-ink p-7 text-white md:p-9">
        <div className="flex h-[124px] w-[124px] flex-none flex-col items-center justify-center rounded-full bg-white text-ink">
          <span className="text-[44px] font-medium leading-none">{r.overall_score}</span>
          <span className="text-[13px] font-semibold text-muted">out of 100</span>
        </div>
        <div className="min-w-0 flex-[1_1_300px]">
          <span className={`inline-block rounded-full px-3 py-1 text-[13px] font-bold text-ink ${VERDICT_BG[r.verdict] ?? "bg-peach"}`}>
            {r.verdict}
          </span>
          <h1 id="sc-h" className="mt-3 text-[24px] font-light leading-snug md:text-[28px]">
            {r.summary}
          </h1>
          <p className="mt-2 text-[13px] text-[#D8D2CC]">
            {answered} of {mock.questions.length} questions answered
          </p>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section aria-labelledby="sc-strengths" className="rounded-[32px] bg-mint p-6">
          <h2 id="sc-strengths" className="mb-3 text-[20px] font-medium">
            What went well
          </h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed">
            {r.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="sc-fix" className="rounded-[32px] bg-pink p-6">
          <h2 id="sc-fix" className="mb-3 text-[20px] font-medium">
            Fix these first
          </h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-relaxed">
            {r.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      </div>

      <h2 className="mt-2 text-[24px] font-medium">Question by question</h2>
      <ol className="flex flex-col gap-4">
        {mock.questions.map((q, i) => {
          const s = r.questions[i];
          const total = s ? SCORES.reduce((n, [k]) => n + s.scores[k], 0) : 0;
          return (
            <li key={i} className="flex flex-col gap-3.5 rounded-[32px] bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-[13px] font-semibold text-muted">Question {i + 1}</p>
                {s ? <span className="rounded-full bg-lavender px-3 py-1 text-[13px] font-bold">{total}/20</span> : null}
              </div>
              <h3 className="text-[19px] font-medium leading-snug">{q.text}</h3>
              {s ? (
                <>
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {SCORES.map(([k, label]) => (
                      <div key={k} className="rounded-2xl bg-ground px-3 py-2">
                        <dt className="text-[12px] font-semibold text-muted">{label}</dt>
                        <dd className="text-[18px] font-medium">{s.scores[k]}/5</dd>
                      </div>
                    ))}
                  </dl>
                  {s.comment ? <p className="text-[15px]">{s.comment}</p> : null}
                  {s.better ? (
                    <p className="rounded-2xl bg-peach px-4 py-2.5 text-[14px]">
                      <strong className="font-semibold">Make it stronger:</strong> {s.better}
                    </p>
                  ) : null}
                </>
              ) : null}
              <details className="rounded-[20px] bg-ground px-4">
                <summary className="flex min-h-[48px] cursor-pointer items-center text-sm font-semibold">Your answer</summary>
                <div className="flex flex-col gap-2 pb-4 text-[14px] leading-relaxed">
                  <p>{q.answer || <em className="text-muted">No answer</em>}</p>
                  {q.followup ? (
                    <>
                      <p className="mt-1 font-semibold">Follow-up: {q.followup}</p>
                      <p>{q.followup_answer || <em className="text-muted">No answer</em>}</p>
                    </>
                  ) : null}
                </div>
              </details>
              <ModelAnswer jdId={mock.jd.id} itemId={q.item_id} />
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-3 pb-6">
        <Link href={`/mock/${mock.jd.id}`} className={primaryLink}>
          Start another mock interview
        </Link>
        <Link
          href={`/kit/${mock.jd.id}`}
          className="inline-flex min-h-[48px] items-center rounded-full bg-white px-5 text-sm font-semibold no-underline hover:bg-panel"
        >
          Back to the prep kit
        </Link>
      </div>
    </div>
  );
}
