"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Mic, Repeat, Square, Volume2, VolumeX } from "lucide-react";
import { api } from "@/lib/client";
import type { MockScore } from "@/lib/schemas";
import { useDictation } from "@/components/hooks";
import { AppShell, ErrorBox, PrimaryButton, SecondaryButton, Spinner, fieldInput, ConfirmDialog } from "@/components/ui";
import { Scorecard, type MockView } from "./Scorecard";

const FOLLOWUP_SECONDS = 90;
const TYPE_LABEL: Record<string, string> = {
  concept: "Concept",
  case: "Case",
  situational: "Situational",
  behavioral: "Behavioral",
  gap: "Gap",
  resume: "About you",
  question: "Role knowledge",
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/** Speak a question with the browser's built-in voice (Indian English when available). */
function speak(text: string, onEnd: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return onEnd();
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  u.voice = voices.find((v) => v.lang === "en-IN") ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
  u.lang = u.voice?.lang ?? "en-IN";
  u.rate = 1;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}

function MockSession() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const voiceMode = search.get("mode") !== "typed";
  const [readAloud, setReadAloud] = useState(search.get("voice") !== "0");
  const [mock, setMock] = useState<MockView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<"main" | "followup">("main");
  const [answer, setAnswer] = useState("");
  // Seconds left for the current question; null until its timer starts (and between questions).
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState<"" | "saving" | "followup" | "scoring">("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const submitted = useRef(false);

  const dict = useDictation(useCallback((t: string) => setAnswer(t), []));

  const load = useCallback(() => {
    setError(null);
    api<{ mock: MockView }>(`/api/mock/${id}`)
      .then((r) => {
        setMock(r.mock);
        // Resume where the user left off (e.g. after a refresh).
        const qs = r.mock.questions;
        const pending = qs.findIndex((q) => !q.answer || (q.followup && !q.followup_answer));
        const at = pending === -1 ? qs.length - 1 : pending;
        setIndex(at);
        setStage(qs[at]?.answer && qs[at]?.followup ? "followup" : "main");
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const q = mock?.questions[index];
  const prompt = q ? (stage === "followup" ? q.followup : q.text) : "";
  const total = mock?.questions.length ?? 0;
  const limit = stage === "followup" ? FOLLOWUP_SECONDS : (mock?.seconds_per_question ?? 180);

  // New question (or follow-up): reset the answer and timer, read it out, then listen in voice mode.
  useEffect(() => {
    if (!mock || mock.result || !prompt) return;
    submitted.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswer("");
    setLeft(limit);
    const startListening = () => {
      if (voiceMode && dict.supported) dict.start("");
    };
    if (readAloud) speak(prompt, startListening);
    else startListening();
    return () => {
      window.speechSynthesis?.cancel();
    };
    // Re-run only when the question changes, not when toggles or the dictation hook re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mock?.id, mock?.result, index, stage]);

  async function submit() {
    if (!mock || !q || submitted.current) return;
    submitted.current = true;
    if (dict.listening) dict.stop();
    window.speechSynthesis?.cancel();
    setBusy(stage === "main" && q.followup_eligible && !q.followup ? "followup" : "saving");
    try {
      const r = await api<{ followup: string | null }>(`/api/mock/${id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, stage, answer, inputMode: voiceMode ? "voice" : "typed" }),
      });
      setLeft(null);
      const updated = { ...mock, questions: mock.questions.map((x) => ({ ...x })) };
      const cur = updated.questions[index];
      if (stage === "main") {
        cur.answer = answer;
        cur.followup = r.followup ?? "";
      } else cur.followup_answer = answer;
      setMock(updated);
      setBusy("");
      if (stage === "main" && r.followup) setStage("followup");
      else if (index < total - 1) {
        setStage("main");
        setIndex(index + 1);
      } else await finish();
    } catch (e) {
      submitted.current = false;
      setBusy("");
      setError((e as Error).message);
    }
  }

  async function finish() {
    if (dict.listening) dict.stop();
    window.speechSynthesis?.cancel();
    setConfirmEnd(false);
    setBusy("scoring");
    setError(null);
    try {
      const r = await api<{ result: MockScore }>(`/api/mock/${id}/finish`, { method: "POST" });
      setMock((m) => (m ? { ...m, result: r.result, finished: true } : m));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  // Countdown; when time runs out the answer is submitted as it stands.
  useEffect(() => {
    if (!mock || mock.result || busy || !prompt || left === null) return;
    if (left <= 0) {
      void Promise.resolve().then(submit);
      return;
    }
    const t = setTimeout(() => setLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, busy, mock?.result, prompt]);

  const progress = useMemo(() => (total ? Math.round((index / total) * 100) : 0), [index, total]);

  if (error && !mock) {
    return (
      <AppShell active="mock">
        <ErrorBox message={error} onRetry={load} />
      </AppShell>
    );
  }
  if (!mock) {
    return (
      <AppShell active="mock">
        <Spinner label="Loading your interview…" />
      </AppShell>
    );
  }
  if (mock.result) {
    return (
      <AppShell active="mock" jdId={mock.jd.id}>
        <Scorecard mock={mock} />
      </AppShell>
    );
  }

  if (busy === "scoring") {
    return (
      <AppShell active="mock" jdId={mock.jd.id}>
        <div className="mx-auto mt-16 flex max-w-[560px] flex-col items-center gap-4 text-center">
          <h1 className="text-[36px] font-light leading-tight">That&apos;s the interview.</h1>
          <Spinner label="The panel is scoring your answers…" />
        </div>
      </AppShell>
    );
  }

  const shown = left ?? limit;
  const lowTime = shown <= 20;
  return (
    <AppShell active="mock" jdId={mock.jd.id}>
      <div className="mx-auto flex max-w-[860px] flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted">
            Mock interview · {mock.jd.role}
            {mock.jd.company ? ` · ${mock.jd.company}` : ""}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (readAloud) window.speechSynthesis?.cancel();
                setReadAloud((v) => !v);
              }}
              aria-pressed={readAloud}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold hover:bg-panel"
            >
              {readAloud ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
              {readAloud ? "Voice on" : "Voice off"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              className="inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold text-muted hover:text-ink"
            >
              End interview
            </button>
          </div>
        </div>

        <div aria-hidden className="h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${progress}%` }} />
        </div>

        <section aria-labelledby="mock-q" className="flex flex-col gap-4 rounded-[36px] bg-ink p-7 text-white md:p-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="rounded-full bg-white/15 px-3 py-1">
                Question {index + 1} of {total}
              </span>
              <span className={`rounded-full px-3 py-1 ${stage === "followup" ? "bg-peach text-ink" : "bg-white/15"}`}>
                {stage === "followup" ? "Follow-up" : TYPE_LABEL[q?.type ?? ""] ?? "Question"}
              </span>
            </span>
            <span
              role="timer"
              aria-label={`${mmss(shown)} left`}
              className={`rounded-full px-3.5 py-1.5 font-mono text-[15px] font-semibold ${lowTime ? "bg-pink text-ink" : "bg-white/15"}`}
            >
              {mmss(shown)}
            </span>
          </div>
          <h1 id="mock-q" className="text-[26px] font-light leading-snug md:text-[32px]">
            {prompt}
          </h1>
          {readAloud ? (
            <button
              type="button"
              onClick={() => speak(prompt, () => undefined)}
              className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/20"
            >
              <Repeat size={15} aria-hidden /> Repeat the question
            </button>
          ) : null}
        </section>

        {voiceMode ? (
          dict.listening ? (
            <div className="flex flex-wrap items-center gap-3 rounded-full bg-white p-2.5 pl-5">
              <span className="flex flex-1 items-center gap-2.5 text-sm font-semibold">
                <span className="h-3 w-3 animate-pulse rounded-full bg-[#D64545]" aria-hidden /> Listening… your words appear below
              </span>
              <button
                type="button"
                onClick={dict.stop}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white"
              >
                <Square size={13} aria-hidden /> Pause
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <SecondaryButton onClick={() => dict.start(answer)} disabled={!dict.supported} className="min-h-[52px] bg-ink! px-6 text-white! hover:bg-black!">
                <Mic size={18} aria-hidden /> {answer ? "Continue speaking" : "Start speaking"}
              </SecondaryButton>
              {!dict.supported ? <span className="text-[13px] text-muted">Voice needs Chrome or Edge. You can type instead.</span> : null}
            </div>
          )
        ) : null}
        {dict.error ? <ErrorBox message={dict.error} /> : null}

        <label htmlFor="mock-answer" className="sr-only">
          Your answer
        </label>
        <textarea
          id="mock-answer"
          rows={7}
          className={`${fieldInput} rounded-[28px] bg-white! p-4.5`}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={voiceMode ? "Your spoken answer appears here. You can also type or fix it." : "Type your answer."}
        />

        {error ? <ErrorBox message={error} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted">
            {stage === "followup" ? "Answer the follow-up briefly." : "When time runs out, your answer is submitted as it is."}
          </p>
          <PrimaryButton onClick={submit} disabled={!!busy} className="min-h-[52px]">
            {busy === "followup" ? "The interviewer is thinking…" : busy === "saving" ? "Saving…" : index === total - 1 && (stage === "followup" || !q?.followup_eligible) ? "Finish the interview" : "Submit and continue →"}
          </PrimaryButton>
        </div>
      </div>

      {confirmEnd ? (
        <ConfirmDialog
          title="End the interview now?"
          message={<p>Prepy will score the questions you have answered so far. Unanswered questions count as no answer.</p>}
          confirmLabel="End and score it"
          onConfirm={finish}
          onCancel={() => setConfirmEnd(false)}
        />
      ) : null}
    </AppShell>
  );
}

export default function MockSessionPage() {
  return (
    <Suspense fallback={null}>
      <MockSession />
    </Suspense>
  );
}
