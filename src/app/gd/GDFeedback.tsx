"use client";

export type GDTurnView = { speaker: string; text: string; round: number; kind: "point" | "open" | "summary" | "pass" };
export type GDView = {
  id: string;
  created_at: string;
  mode: "quick" | "full";
  topic: string;
  context: string;
  members: { name: string; style: string }[];
  turns: GDTurnView[];
  rounds_done: number;
  input_mode: "typed" | "voice";
  result: {
    overall_score: number;
    verdict: string;
    summary: string;
    scores: { content: number; participation: number; listening: number; clarity: number; leadership: number };
    strengths: string[];
    improvements: string[];
    turn_feedback: { index: number; comment: string }[];
  } | null;
};

export const MEMBER_BG = ["bg-lavender", "bg-peach", "bg-mint"];

const SCORES = [
  ["content", "Content"],
  ["participation", "Participation"],
  ["listening", "Building on others"],
  ["clarity", "Clarity"],
  ["leadership", "Leadership"],
] as const;
const VERDICT_BG: Record<string, string> = {
  "Stand-out performance": "bg-mint",
  "Solid contributor": "bg-mint",
  Average: "bg-peach",
  "Needs more practice": "bg-pink",
};
const KIND_LABEL: Record<string, string> = { open: "Opening", summary: "Summary", pass: "Passed", point: "" };

/** The discussion, with the user's turns highlighted (and their feedback, if any). */
export function GDTranscript({ gd, feedback }: { gd: GDView; feedback?: Map<number, string> }) {
  let yourIndex = 0;
  return (
    <ol className="flex flex-col gap-3">
      {gd.turns.map((t, i) => {
        const you = t.speaker === "You";
        const n = you ? ++yourIndex : 0;
        const m = gd.members.findIndex((x) => x.name === t.speaker);
        const note = you ? feedback?.get(n) : undefined;
        return (
          <li key={i} className={`flex flex-col gap-1.5 rounded-[24px] p-4 ${you ? "bg-ink text-white" : MEMBER_BG[m % 3] ?? "bg-white"}`}>
            <p className={`text-[13px] font-semibold ${you ? "text-[#D8D2CC]" : ""}`}>
              {t.speaker}
              {KIND_LABEL[t.kind] ? ` · ${KIND_LABEL[t.kind]}` : ""}
            </p>
            <p className="text-[15px] leading-relaxed">{t.kind === "pass" ? <em className="opacity-70">Passed this round</em> : t.text || <em className="opacity-70">(nothing said)</em>}</p>
            {note ? <p className="mt-1 rounded-2xl bg-white/10 px-3 py-2 text-[13px]">Feedback: {note}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Feedback after a group discussion. */
export function GDFeedback({ gd }: { gd: GDView }) {
  const r = gd.result!;
  const notes = new Map(r.turn_feedback.map((t) => [t.index, t.comment]));
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="gd-h" className="flex flex-wrap items-center gap-6 rounded-[36px] bg-ink p-7 text-white md:p-9">
        <div className="flex h-[116px] w-[116px] flex-none flex-col items-center justify-center rounded-full bg-white text-ink">
          <span className="text-[42px] font-medium leading-none">{r.overall_score}</span>
          <span className="text-[13px] font-semibold text-muted">out of 100</span>
        </div>
        <div className="min-w-0 flex-[1_1_280px]">
          <span className={`inline-block rounded-full px-3 py-1 text-[13px] font-bold text-ink ${VERDICT_BG[r.verdict] ?? "bg-peach"}`}>{r.verdict}</span>
          <p className="mt-2 text-[13px] font-semibold text-[#D8D2CC]">{gd.topic}</p>
          <h2 id="gd-h" className="mt-1.5 text-[22px] font-light leading-snug md:text-[26px]">
            {r.summary}
          </h2>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {SCORES.map(([k, label], i) => (
          <div key={k} className={`flex flex-col gap-2 rounded-[24px] p-4 ${["bg-mint", "bg-peach", "bg-lavender", "bg-pink", "bg-white"][i]}`}>
            <dt className="text-[13px] font-semibold">{label}</dt>
            <dd className="text-[28px] font-medium leading-none">
              {r.scores[k]}
              <span className="text-[14px] font-normal">/5</span>
            </dd>
          </div>
        ))}
      </dl>

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

      <section>
        <h3 className="mb-3 text-[22px] font-medium">{gd.mode === "full" ? "The discussion" : "Your contribution"}</h3>
        <GDTranscript gd={gd} feedback={notes} />
      </section>
    </div>
  );
}
