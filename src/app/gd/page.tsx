"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Mic, Shuffle, Square, Volume2, VolumeX } from "lucide-react";
import { api } from "@/lib/client";
import { useDictation } from "@/components/hooks";
import { AppShell, ErrorBox, PageTitle, PanelCard, PrimaryButton, SecondaryButton, Spinner, fieldInput } from "@/components/ui";
import { GDFeedback, GDTranscript, MEMBER_BG, type GDView } from "./GDFeedback";

type Phase = "setup" | "topic" | "quick" | "full" | "scoring" | "done";
type Next = "start" | "turn" | "summary";
type Past = { id: string; created_at: string; mode: "quick" | "full"; topic: string; overall_score: number | null };

// Other participants besides you: 0 = just you (a solo contribution against the clock).
const PARTICIPANTS = [
  { n: 0, label: "0 · just me", note: "Your solo contribution, 2 minutes" },
  { n: 2, label: "2 participants", note: "Aditi and Rahul" },
  { n: 3, label: "3 participants", note: "Aditi, Rahul and Meera" },
];

const QUICK_SECONDS = 120;
const ROUNDS = 3;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

/** Read the members' new points aloud, one after another, each in a different voice. */
function speakPoints(points: { name: string; text: string; member: number }[], onSpeaker: (name: string | null) => void, onDone: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !points.length) return onDone();
  const synth = window.speechSynthesis;
  synth.cancel();
  const voices = synth.getVoices().filter((v) => v.lang.startsWith("en"));
  points.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p.text);
    u.voice = voices.length ? voices[p.member % voices.length] : null;
    u.lang = u.voice?.lang ?? "en-IN";
    u.pitch = [1.1, 0.85, 1.0][p.member % 3];
    u.rate = 1.02;
    u.onstart = () => onSpeaker(p.name);
    const last = i === points.length - 1;
    u.onend = () => {
      if (last) {
        onSpeaker(null);
        onDone();
      }
    };
    u.onerror = u.onend;
    synth.speak(u);
  });
}

/** Group discussion practice: quick (one contribution) or full (three AI members, in rounds). */
export default function GDPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [participants, setParticipants] = useState(3);
  const mode: "quick" | "full" = participants === 0 ? "quick" : "full";
  const [inputMode, setInputMode] = useState<"voice" | "typed">("voice");
  const [readAloud, setReadAloud] = useState(true);
  const [topic, setTopic] = useState<{ topic: string; context: string } | null>(null);
  // Every topic shown in this visit, so "Different topic" never brings one back.
  const shown = useRef<string[]>([]);
  const [gd, setGd] = useState<GDView | null>(null);
  const [next, setNext] = useState<Next>("start");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"" | "topic" | "starting" | "members">("");
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState<Past[] | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const dict = useDictation(useCallback((t: string) => setText(t), []));
  const voice = inputMode === "voice" && dict.supported;

  const loadPast = useCallback(() => {
    api<{ gds: Past[] }>("/api/gd")
      .then((r) => setPast(r.gds))
      .catch(() => setPast([]));
  }, []);
  useEffect(() => {
    void Promise.resolve().then(loadPast);
    return () => window.speechSynthesis?.cancel();
  }, [loadPast]);

  async function getTopic() {
    setError(null);
    setBusy("topic");
    try {
      const r = await api<{ topic: { topic: string; context: string } }>("/api/gd/topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exclude: shown.current }),
      });
      shown.current = [...shown.current, r.topic.topic];
      setTopic(r.topic);
      setPhase("topic");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function begin() {
    if (!topic) return;
    setError(null);
    setBusy("starting");
    try {
      const r = await api<{ gd: GDView }>("/api/gd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants, topic: topic.topic, context: topic.context, input_mode: voice ? "voice" : "typed" }),
      });
      setGd(r.gd);
      setText("");
      setNext("start");
      if (mode === "quick") {
        setPhase("quick");
        setLeft(QUICK_SECONDS);
        if (voice) dict.start("");
      } else setPhase("full");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  /** After the members' round: read it out (if on), then hand the turn to the user. */
  function afterRound(before: number, updated: GDView) {
    const fresh = updated.turns
      .slice(before)
      .filter((t) => t.speaker !== "You")
      .map((t) => ({ name: t.speaker, text: t.text, member: updated.members.findIndex((m) => m.name === t.speaker) }));
    const yourTurn = () => {
      if (voice) dict.start("");
    };
    if (readAloud) speakPoints(fresh, setSpeaking, yourTurn);
    else yourTurn();
  }

  async function move(action: "start" | "speak" | "pass" | "summary") {
    if (!gd) return;
    if (dict.listening) dict.stop();
    window.speechSynthesis?.cancel();
    setSpeaking(null);
    setError(null);
    setBusy(action === "summary" ? "" : "members");
    if (action === "summary") setPhase("scoring");
    const before = gd.turns.length + (action === "start" ? 0 : 1);
    try {
      const r = await api<{ gd: GDView; next: "turn" | "summary" | "finish" }>(`/api/gd/${gd.id}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text }),
      });
      setGd(r.gd);
      setText("");
      if (r.next === "finish") await finish(r.gd.id);
      else {
        setNext(r.next);
        afterRound(before, r.gd);
      }
    } catch (e) {
      setError((e as Error).message);
      if (action === "summary") setPhase("full");
    } finally {
      setBusy("");
    }
  }

  async function finish(id: string) {
    setPhase("scoring");
    setLeft(null);
    try {
      const r = await api<{ result: GDView["result"] }>(`/api/gd/${id}/finish`, { method: "POST" });
      setGd((g) => (g ? { ...g, result: r.result } : g));
      setPhase("done");
      loadPast();
    } catch (e) {
      setError((e as Error).message);
      setPhase(mode === "quick" ? "quick" : "full");
    }
  }

  async function submitQuick() {
    if (!gd) return;
    if (dict.listening) dict.stop();
    setLeft(null);
    setPhase("scoring");
    try {
      await api(`/api/gd/${gd.id}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "summary", text }),
      });
      await finish(gd.id);
    } catch (e) {
      setError((e as Error).message);
      setPhase("quick");
    }
  }

  // Quick mode countdown; at zero the contribution is submitted as it stands.
  useEffect(() => {
    if (phase !== "quick" || left === null) return;
    if (left <= 0) {
      void Promise.resolve().then(submitQuick);
      return;
    }
    const t = setTimeout(() => setLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, phase]);

  // Keep the newest turn in view.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [gd?.turns.length, busy]);

  const chip = (on: boolean) =>
    `inline-flex min-h-[48px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
      on ? "bg-ink text-white" : "bg-white text-ink hover:bg-ground"
    }`;

  const answerBox = (placeholder: string) => (
    <>
      {voice ? (
        dict.listening ? (
          <div className="flex flex-wrap items-center gap-3 rounded-full bg-white p-2.5 pl-5">
            <span className="flex flex-1 items-center gap-2.5 text-sm font-semibold">
              <span className="h-3 w-3 animate-pulse rounded-full bg-[#D64545]" aria-hidden /> Listening…
            </span>
            <button type="button" onClick={dict.stop} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white">
              <Square size={13} aria-hidden /> Pause
            </button>
          </div>
        ) : (
          <SecondaryButton onClick={() => dict.start(text)} className="min-h-[48px] self-start bg-ink! px-6 text-white! hover:bg-black!">
            <Mic size={18} aria-hidden /> {text ? "Continue speaking" : "Start speaking"}
          </SecondaryButton>
        )
      ) : null}
      {dict.error ? <ErrorBox message={dict.error} /> : null}
      <label htmlFor="gd-text" className="sr-only">
        Your point
      </label>
      <textarea
        id="gd-text"
        rows={5}
        className={`${fieldInput} rounded-[24px] bg-white! p-4`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
      />
    </>
  );

  const panel = (
    <>
      {phase === "full" && gd ? (
        <PanelCard title="In this GD">
          <ul className="flex flex-col gap-2.5">
            {gd.members.map((m, i) => (
              <li key={m.name} className={`flex items-start gap-3 rounded-[20px] p-3 ${speaking === m.name ? "ring-2 ring-ink" : ""} ${MEMBER_BG[i % 3]}`}>
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white font-semibold">{m.name[0]}</span>
                <span className="text-[13px]">
                  <strong className="block text-[15px]">
                    {m.name}
                    {speaking === m.name ? " · speaking" : ""}
                  </strong>
                  {m.style.split(";")[0]}
                </span>
              </li>
            ))}
            <li className="flex items-center gap-3 rounded-[20px] bg-ink p-3 text-white">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white font-semibold text-ink">Y</span>
              <strong className="text-[15px]">You</strong>
            </li>
          </ul>
        </PanelCard>
      ) : (
        <PanelCard title="How it works">
          <ul className="flex flex-col gap-2.5 text-sm">
            <li>
              <strong>Just you:</strong> a topic, your two-minute contribution, then feedback.
            </li>
            <li>
              <strong>With 2 or 3 participants:</strong> they speak in {ROUNDS} rounds. After each round you add a point or pass, then you summarise the discussion.
            </li>
            <li>Feedback covers content, participation, building on others, clarity and leadership.</li>
          </ul>
        </PanelCard>
      )}
      <PanelCard title="Your past discussions">
        {!past ? (
          <p className="text-sm">Loading…</p>
        ) : past.length === 0 ? (
          <p className="text-sm">Your discussions will appear here.</p>
        ) : (
          <ul className="flex flex-col">
            {past.slice(0, 10).map((g) => (
              <li key={g.id}>
                <Link href={`/gd/${g.id}`} className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl px-2 py-2 no-underline hover:bg-ground">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{g.topic}</span>
                    <span className="block text-xs text-muted">
                      {g.mode === "full" ? "Group" : "Just me"} · {new Date(g.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  {g.overall_score !== null ? <span className="flex-none rounded-full bg-mint px-2.5 py-1 text-xs font-bold">{g.overall_score}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </>
  );

  const roundLabel = gd ? (next === "summary" ? "Summarise the discussion" : next === "start" ? "Open the discussion, or let others start" : `Your turn · after round ${gd.rounds_done} of ${ROUNDS}`) : "";

  return (
    <AppShell active="gd" nav="home" panel={panel}>
      <PageTitle eyebrow="Practice">Group discussion</PageTitle>

      {phase === "setup" || phase === "topic" ? (
        <section aria-label="Set up" className="mt-8 flex max-w-[760px] flex-col gap-6 rounded-[32px] bg-lavender p-6 md:p-7">
          <fieldset>
            <legend className="mb-2.5 text-[15px] font-semibold">Other participants</legend>
            <div className="flex flex-wrap gap-2.5">
              {PARTICIPANTS.map((p) => (
                <button
                  key={p.n}
                  type="button"
                  aria-pressed={participants === p.n}
                  onClick={() => setParticipants(p.n)}
                  className={`flex min-h-[60px] flex-1 flex-col items-start justify-center rounded-[20px] px-4 py-2 text-left transition ${
                    participants === p.n ? "bg-ink text-white" : "bg-white text-ink hover:bg-ground"
                  }`}
                >
                  <span className="text-[15px] font-semibold">{p.label}</span>
                  <span className={`text-[12px] ${participants === p.n ? "text-white/75" : "text-muted"}`}>
                    {p.n ? `${p.note} · ${ROUNDS} rounds` : p.note}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2.5 text-[15px] font-semibold">How will you speak?</legend>
            <div className="flex flex-wrap gap-2.5">
              <button type="button" aria-pressed={inputMode === "voice"} onClick={() => setInputMode("voice")} className={chip(inputMode === "voice")}>
                <Mic size={16} aria-hidden /> Speaking
              </button>
              <button type="button" aria-pressed={inputMode === "typed"} onClick={() => setInputMode("typed")} className={chip(inputMode === "typed")}>
                <Keyboard size={16} aria-hidden /> Typing
              </button>
            </div>
          </fieldset>
          {mode === "full" ? (
            <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[20px] bg-white px-4 py-2.5">
              <input type="checkbox" checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} className="h-5 w-5 flex-none accent-ink" />
              {readAloud ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
              <span className="text-[15px] font-medium">Read the members&apos; points out loud</span>
            </label>
          ) : null}

          {phase === "topic" && topic ? (
            <div className="rounded-[24px] bg-ink p-5 text-white">
              <p className="text-[13px] font-semibold text-[#D8D2CC]">Your topic</p>
              <p className="mt-1 text-[24px] font-light leading-snug">{topic.topic}</p>
              {topic.context ? <p className="mt-2 text-[14px] text-[#D8D2CC]">{topic.context}</p> : null}
            </div>
          ) : null}
          {error ? <ErrorBox message={error} /> : null}
          <div className="flex flex-wrap gap-3">
            {phase === "topic" ? (
              <>
                <PrimaryButton onClick={begin} disabled={!!busy} className="min-h-[52px]">
                  {busy === "starting" ? "Setting the table…" : "Start the discussion →"}
                </PrimaryButton>
                <SecondaryButton onClick={getTopic} disabled={!!busy} className="min-h-[52px]">
                  <Shuffle size={16} aria-hidden /> {busy === "topic" ? "Picking…" : "Different topic"}
                </SecondaryButton>
              </>
            ) : (
              <PrimaryButton onClick={getTopic} disabled={!!busy} className="min-h-[52px]">
                {busy === "topic" ? "Picking a topic…" : "Give me a topic →"}
              </PrimaryButton>
            )}
          </div>
        </section>
      ) : null}

      {phase === "quick" && gd ? (
        <div className="mt-8 flex max-w-[860px] flex-col gap-5">
          <section className="flex flex-col gap-3 rounded-[36px] bg-ink p-7 text-white md:p-9">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-mint px-3 py-1 text-[13px] font-semibold text-ink">Your contribution</span>
              <span role="timer" className={`rounded-full px-3.5 py-1.5 font-mono text-[18px] font-semibold ${(left ?? 99) <= 15 ? "bg-pink text-ink" : "bg-white/15"}`}>
                {mmss(left ?? QUICK_SECONDS)}
              </span>
            </div>
            <h2 className="text-[26px] font-light leading-snug md:text-[32px]">{gd.topic}</h2>
          </section>
          {answerBox(voice ? "Your words appear here as you speak." : "Type your contribution.")}
          {error ? <ErrorBox message={error} /> : null}
          <div className="flex justify-end">
            <PrimaryButton onClick={submitQuick} className="min-h-[52px]">
              I&apos;m done →
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      {phase === "full" && gd ? (
        <div className="mt-8 flex max-w-[860px] flex-col gap-5">
          <section className="rounded-[32px] bg-ink p-6 text-white">
            <p className="text-[13px] font-semibold text-[#D8D2CC]">
              Topic · {gd.rounds_done} of {ROUNDS} rounds
            </p>
            <h2 className="mt-1 text-[24px] font-light leading-snug">{gd.topic}</h2>
          </section>

          {gd.turns.length ? <GDTranscript gd={gd} /> : <p className="text-[15px] text-muted">Nobody has spoken yet.</p>}

          {busy === "members" ? (
            <Spinner label="The others are making their points…" />
          ) : (
            <section aria-label="Your turn" className="flex flex-col gap-3 rounded-[28px] bg-white/60 p-5 ring-1 ring-panel">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[18px] font-medium">{roundLabel}</h3>
                {readAloud && speaking ? (
                  <button
                    type="button"
                    onClick={() => {
                      window.speechSynthesis?.cancel();
                      setSpeaking(null);
                      if (voice) dict.start(text);
                    }}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold hover:bg-panel"
                  >
                    <VolumeX size={15} aria-hidden /> Skip reading
                  </button>
                ) : null}
              </div>
              {next === "start" ? (
                <p className="text-sm text-muted">Opening a GD well earns credit. You can also let the others start and come in later.</p>
              ) : null}
              {answerBox(next === "summary" ? "Sum up the main points and the way forward." : "Your point. Build on, or counter, what was said.")}
              {error ? <ErrorBox message={error} /> : null}
              <div className="flex flex-wrap justify-end gap-3">
                {next === "start" ? (
                  <>
                    <SecondaryButton onClick={() => move("start")} className="min-h-[52px] bg-panel">
                      Let others start
                    </SecondaryButton>
                    <PrimaryButton onClick={() => move("speak")} disabled={!text.trim()} className="min-h-[52px]">
                      Open the discussion →
                    </PrimaryButton>
                  </>
                ) : next === "summary" ? (
                  <PrimaryButton onClick={() => move("summary")} className="min-h-[52px]">
                    Summarise and finish →
                  </PrimaryButton>
                ) : (
                  <>
                    <SecondaryButton onClick={() => move("pass")} className="min-h-[52px] bg-panel">
                      Pass this round
                    </SecondaryButton>
                    <PrimaryButton onClick={() => move("speak")} disabled={!text.trim()} className="min-h-[52px]">
                      Add my point →
                    </PrimaryButton>
                  </>
                )}
              </div>
            </section>
          )}
          <div ref={bottom} />
        </div>
      ) : null}

      {phase === "scoring" ? (
        <div className="mt-12">
          <Spinner label="The panel is reviewing your contribution…" />
        </div>
      ) : null}

      {phase === "done" && gd?.result ? (
        <div className="mt-8 flex max-w-[900px] flex-col gap-5">
          <GDFeedback gd={gd} />
          <div className="flex flex-wrap gap-3">
            <PrimaryButton
              onClick={() => {
                setGd(null);
                setTopic(null);
                setPhase("setup");
              }}
              className="min-h-[52px]"
            >
              <Shuffle size={16} aria-hidden /> New discussion
            </PrimaryButton>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
