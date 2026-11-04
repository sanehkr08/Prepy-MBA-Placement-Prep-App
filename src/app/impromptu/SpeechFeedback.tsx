"use client";

export type SpeechView = {
  id: string;
  created_at: string;
  topic: string;
  category: string;
  prep_seconds: number;
  speak_seconds: number;
  duration_seconds: number;
  transcript: string;
  input_mode: "typed" | "voice";
  stats: { words: number; wpm: number; fillers: Record<string, number>; filler_total: number };
  result: {
    overall_score: number;
    headline: string;
    scores: { structure: number; content: number; clarity: number; delivery: number };
    strengths: string[];
    improvements: string[];
    outline: string[];
  };
};

const SCORES = [
  ["structure", "Structure", "bg-mint"],
  ["content", "Content", "bg-peach"],
  ["clarity", "Clarity", "bg-lavender"],
  ["delivery", "Delivery", "bg-pink"],
] as const;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Pace guidance: conversational public speaking is roughly 120–160 words a minute. */
function paceNote(wpm: number) {
  if (!wpm) return "No words were recorded.";
  if (wpm < 110) return "A little slow: aim for 120–160 words a minute.";
  if (wpm > 170) return "Quite fast: slow down and pause between points.";
  return "A comfortable pace.";
}

/** Feedback for one impromptu speech. */
export function SpeechFeedback({ speech }: { speech: SpeechView }) {
  const r = speech.result;
  const fillers = Object.entries(speech.stats.fillers).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="sp-h" className="flex flex-wrap items-center gap-6 rounded-[36px] bg-ink p-7 text-white md:p-9">
        <div className="flex h-[116px] w-[116px] flex-none flex-col items-center justify-center rounded-full bg-white text-ink">
          <span className="text-[42px] font-medium leading-none">{r.overall_score}</span>
          <span className="text-[13px] font-semibold text-muted">out of 100</span>
        </div>
        <div className="min-w-0 flex-[1_1_280px]">
          <p className="text-[13px] font-semibold text-[#D8D2CC]">{speech.topic}</p>
          <h2 id="sp-h" className="mt-2 text-[24px] font-light leading-snug md:text-[28px]">
            {r.headline}
          </h2>
        </div>
      </section>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SCORES.map(([k, label, bg]) => (
          <div key={k} className={`flex flex-col gap-2 rounded-[24px] p-4 ${bg}`}>
            <dt className="text-sm font-semibold">{label}</dt>
            <dd className="text-[30px] font-medium leading-none">
              {r.scores[k]}
              <span className="text-[15px] font-normal">/5</span>
            </dd>
            <dd aria-hidden className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`h-2 flex-1 rounded-full ${n <= r.scores[k] ? "bg-ink" : "bg-white/70"}`} />
              ))}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-label="How you sounded" className="grid gap-3 sm:grid-cols-3">
        {speech.input_mode === "typed" ? (
          <>
            <div className="rounded-[24px] bg-white p-4">
              <p className="text-[13px] font-semibold text-muted">Length</p>
              <p className="text-[26px] font-medium leading-tight">{speech.stats.words} words</p>
              <p className="text-[13px] text-muted">About {Math.round((speech.stats.words / 140) * 60)} seconds if spoken</p>
            </div>
            <div className="rounded-[24px] bg-white p-4">
              <p className="text-[13px] font-semibold text-muted">Pace</p>
              <p className="text-[26px] font-medium leading-tight">Typed</p>
              <p className="text-[13px] text-muted">Speak your next answer to measure pace and time.</p>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-[24px] bg-white p-4">
              <p className="text-[13px] font-semibold text-muted">Time spoken</p>
              <p className="text-[26px] font-medium leading-tight">{mmss(speech.duration_seconds)}</p>
              <p className="text-[13px] text-muted">of {mmss(speech.speak_seconds)}</p>
            </div>
            <div className="rounded-[24px] bg-white p-4">
              <p className="text-[13px] font-semibold text-muted">Pace</p>
              <p className="text-[26px] font-medium leading-tight">{speech.stats.wpm} wpm</p>
              <p className="text-[13px] text-muted">{paceNote(speech.stats.wpm)}</p>
            </div>
          </>
        )}
        <div className="rounded-[24px] bg-white p-4">
          <p className="text-[13px] font-semibold text-muted">Filler words</p>
          <p className="text-[26px] font-medium leading-tight">{speech.stats.filler_total}</p>
          <p className="text-[13px] text-muted">
            {fillers.length ? fillers.map(([f, n]) => `“${f}” ×${n}`).join(", ") : "None. Nicely done."}
          </p>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-[32px] bg-mint p-6">
          <h3 className="mb-3 text-[20px] font-medium">What worked</h3>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed">
            {r.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-[32px] bg-pink p-6">
          <h3 className="mb-3 text-[20px] font-medium">Next time</h3>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-relaxed">
            {r.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      </div>

      {r.outline.length ? (
        <section className="rounded-[32px] bg-lavender p-6">
          <h3 className="mb-3 text-[20px] font-medium">A strong way to structure it</h3>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-relaxed">
            {r.outline.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <details className="rounded-[24px] bg-white px-5">
        <summary className="flex min-h-[52px] cursor-pointer items-center text-sm font-semibold">What you said</summary>
        <p className="pb-5 text-[15px] leading-relaxed">{speech.transcript || <em className="text-muted">Nothing was recorded.</em>}</p>
      </details>
    </div>
  );
}
