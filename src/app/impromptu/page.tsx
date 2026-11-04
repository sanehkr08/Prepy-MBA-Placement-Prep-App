"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Mic, Shuffle, Square } from "lucide-react";
import { api } from "@/lib/client";
import { useDictation } from "@/components/hooks";
import { AppShell, ErrorBox, PageTitle, PanelCard, PrimaryButton, SecondaryButton, Spinner, fieldInput } from "@/components/ui";
import { SpeechFeedback, type SpeechView } from "./SpeechFeedback";

type Phase = "setup" | "loading" | "prep" | "speak" | "scoring" | "done";
type Topic = { topic: string; category: string; angle: string };
type Past = { id: string; created_at: string; topic: string; overall_score: number };

const CATEGORIES = [
  { key: "business", label: "Business and current affairs" },
  { key: "personal", label: "Personal and opinion" },
  { key: "role", label: "Linked to my roles" },
];
const PREPS = [15, 30, 60];
const SPEAKS = [60, 120, 180];

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/** Impromptu speaking: a random topic, a short prep countdown, speak, then feedback. */
export default function ImpromptuPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [cats, setCats] = useState<string[]>(["business", "personal", "role"]);
  const [prep, setPrep] = useState(30);
  const [speak, setSpeak] = useState(120);
  const [mode, setMode] = useState<"voice" | "typed">("voice");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [showAngle, setShowAngle] = useState(false);
  const [transcript, setTranscript] = useState("");
  // Seconds left in the current countdown; null when no countdown is running.
  const [left, setLeft] = useState<number | null>(null);
  const startedAt = useRef(0);
  const [result, setResult] = useState<SpeechView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState<Past[] | null>(null);

  const dict = useDictation(useCallback((t: string) => setTranscript(t), []));
  const voice = mode === "voice" && dict.supported;

  const loadPast = useCallback(() => {
    api<{ speeches: Past[] }>("/api/impromptu")
      .then((r) => setPast(r.speeches))
      .catch(() => setPast([]));
  }, []);
  useEffect(() => {
    void Promise.resolve().then(loadPast);
  }, [loadPast]);

  async function getTopic() {
    setError(null);
    setPhase("loading");
    setLeft(null);
    setShowAngle(false);
    try {
      const r = await api<{ topic: Topic }>("/api/impromptu/topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: cats }),
      });
      setTopic(r.topic);
      setTranscript("");
      setPhase("prep");
      setLeft(prep);
    } catch (e) {
      setError((e as Error).message);
      setPhase("setup");
    }
  }

  function startSpeaking() {
    setLeft(null);
    setTranscript("");
    startedAt.current = Date.now();
    setPhase("speak");
    setLeft(speak);
    if (voice) dict.start("");
  }

  async function finish() {
    if (phase !== "speak" || !topic) return;
    if (dict.listening) dict.stop();
    setLeft(null);
    const seconds = Math.min(speak, Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
    setPhase("scoring");
    setError(null);
    try {
      const r = await api<{ speech: SpeechView }>("/api/impromptu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.topic,
          category: topic.category,
          prep_seconds: prep,
          speak_seconds: speak,
          duration_seconds: seconds,
          transcript,
          input_mode: voice ? "voice" : "typed",
        }),
      });
      setResult(r.speech);
      setPhase("done");
      loadPast();
    } catch (e) {
      setError((e as Error).message);
      setPhase("speak");
    }
  }

  // One countdown for both phases: prep runs into speaking; speaking ends the attempt.
  useEffect(() => {
    if (left === null || (phase !== "prep" && phase !== "speak")) return;
    if (left <= 0) {
      void Promise.resolve().then(phase === "prep" ? startSpeaking : finish);
      return;
    }
    const t = setTimeout(() => setLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase]);

  const chip = (on: boolean) =>
    `inline-flex min-h-[48px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
      on ? "bg-ink text-white" : "bg-white text-ink hover:bg-ground"
    }`;

  const panel = (
    <>
      <PanelCard title="How it works">
        <ol className="flex flex-col gap-2.5 text-sm">
          <li>1. Get a random topic.</li>
          <li>2. Prepare until the countdown ends, or start early.</li>
          <li>3. Speak until the timer runs out, or finish early.</li>
          <li>4. Get feedback on structure, content, clarity and delivery, with your pace and filler words.</li>
        </ol>
      </PanelCard>
      <PanelCard title="Your past speeches">
        {!past ? (
          <p className="text-sm">Loading…</p>
        ) : past.length === 0 ? (
          <p className="text-sm">Your speeches will appear here.</p>
        ) : (
          <ul className="flex flex-col">
            {past.slice(0, 12).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/impromptu/${s.id}`}
                  className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl px-2 py-2 no-underline hover:bg-ground"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{s.topic}</span>
                    <span className="block text-xs text-muted">{new Date(s.created_at).toLocaleDateString()}</span>
                  </span>
                  <span className="flex-none rounded-full bg-mint px-2.5 py-1 text-xs font-bold">{s.overall_score}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </>
  );

  return (
    <AppShell active="impromptu" nav="home" panel={panel}>
      <PageTitle eyebrow="Practice">Impromptu speaking</PageTitle>

      {phase === "setup" || phase === "loading" ? (
        <section aria-label="Set up" className="mt-8 flex max-w-[760px] flex-col gap-6 rounded-[32px] bg-lavender p-6 md:p-7">
          <p className="text-[16px]">Think on your feet: a random topic, a few seconds to prepare, then speak.</p>
          <fieldset>
            <legend className="mb-2.5 text-[15px] font-semibold">Topics</legend>
            <div className="flex flex-wrap gap-2.5">
              {CATEGORIES.map((c) => {
                const on = cats.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCats((cs) => (on ? cs.filter((x) => x !== c.key) : [...cs, c.key]))}
                    className={chip(on)}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2.5 text-[15px] font-semibold">Time to prepare</legend>
            <div className="flex flex-wrap gap-2.5">
              {PREPS.map((p) => (
                <button key={p} type="button" aria-pressed={prep === p} onClick={() => setPrep(p)} className={chip(prep === p)}>
                  {p} seconds
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2.5 text-[15px] font-semibold">Time to speak</legend>
            <div className="flex flex-wrap gap-2.5">
              {SPEAKS.map((s) => (
                <button key={s} type="button" aria-pressed={speak === s} onClick={() => setSpeak(s)} className={chip(speak === s)}>
                  {s / 60} minute{s > 60 ? "s" : ""}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2.5 text-[15px] font-semibold">How will you answer?</legend>
            <div className="flex flex-wrap gap-2.5">
              <button type="button" aria-pressed={mode === "voice"} onClick={() => setMode("voice")} className={chip(mode === "voice")}>
                <Mic size={16} aria-hidden /> Speaking
              </button>
              <button type="button" aria-pressed={mode === "typed"} onClick={() => setMode("typed")} className={chip(mode === "typed")}>
                <Keyboard size={16} aria-hidden /> Typing
              </button>
            </div>
            {mode === "voice" && !dict.supported ? (
              <p className="mt-2 text-[13px]">Voice needs Chrome or Edge. In this browser you will type instead.</p>
            ) : null}
          </fieldset>
          {error ? <ErrorBox message={error} onRetry={getTopic} /> : null}
          <div>
            <PrimaryButton onClick={getTopic} disabled={!cats.length || phase === "loading"} className="min-h-[52px]">
              {phase === "loading" ? "Picking a topic…" : "Give me a topic →"}
            </PrimaryButton>
          </div>
        </section>
      ) : null}

      {(phase === "prep" || phase === "speak") && topic ? (
        <div className="mt-8 flex max-w-[860px] flex-col gap-5">
          <section aria-labelledby="imp-topic" className="flex flex-col gap-4 rounded-[36px] bg-ink p-7 text-white md:p-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${phase === "prep" ? "bg-peach text-ink" : "bg-mint text-ink"}`}>
                {phase === "prep" ? "Prepare" : "Speak now"}
                {topic.category ? ` · ${topic.category}` : ""}
              </span>
              <span
                role="timer"
                className={`rounded-full px-3.5 py-1.5 font-mono text-[18px] font-semibold ${
                  (left ?? 99) <= 10 ? "bg-pink text-ink" : "bg-white/15"
                }`}
              >
                {mmss(left ?? (phase === "prep" ? prep : speak))}
              </span>
            </div>
            <h2 id="imp-topic" className="text-[28px] font-light leading-snug md:text-[36px]">
              {topic.topic}
            </h2>
            {topic.angle ? (
              showAngle ? (
                <p className="rounded-2xl bg-white/10 px-4 py-2.5 text-[15px]">Angle: {topic.angle}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAngle(true)}
                  className="inline-flex min-h-[44px] items-center self-start rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/20"
                >
                  Need an angle?
                </button>
              )
            ) : null}
          </section>

          {phase === "prep" ? (
            <div className="flex flex-wrap gap-3">
              <PrimaryButton onClick={startSpeaking} className="min-h-[52px]">
                {voice ? <Mic size={18} aria-hidden /> : null} Start speaking now
              </PrimaryButton>
              <SecondaryButton onClick={getTopic} className="min-h-[52px]">
                <Shuffle size={16} aria-hidden /> Different topic
              </SecondaryButton>
            </div>
          ) : (
            <>
              {voice ? (
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
                  <SecondaryButton onClick={() => dict.start(transcript)} className="min-h-[52px] self-start bg-ink! px-6 text-white! hover:bg-black!">
                    <Mic size={18} aria-hidden /> {transcript ? "Continue speaking" : "Start speaking"}
                  </SecondaryButton>
                )
              ) : null}
              {dict.error ? <ErrorBox message={dict.error} /> : null}
              <label htmlFor="imp-text" className="sr-only">
                Your speech
              </label>
              <textarea
                id="imp-text"
                rows={7}
                className={`${fieldInput} rounded-[28px] bg-white! p-4.5`}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={voice ? "Your words appear here as you speak." : "Type what you would say."}
              />
              {error ? <ErrorBox message={error} onRetry={finish} /> : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted">When the timer ends, your speech is scored as it stands.</p>
                <PrimaryButton onClick={finish} className="min-h-[52px]">
                  I&apos;m done →
                </PrimaryButton>
              </div>
            </>
          )}
        </div>
      ) : null}

      {phase === "scoring" ? (
        <div className="mt-12">
          <Spinner label="Listening back to your speech…" />
        </div>
      ) : null}

      {phase === "done" && result ? (
        <div className="mt-8 flex max-w-[900px] flex-col gap-5">
          <SpeechFeedback speech={result} />
          <div className="flex flex-wrap gap-3">
            <PrimaryButton onClick={getTopic} className="min-h-[52px]">
              <Shuffle size={16} aria-hidden /> Try another topic
            </PrimaryButton>
            <SecondaryButton onClick={() => setPhase("setup")} className="min-h-[52px]">
              Change settings
            </SecondaryButton>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
