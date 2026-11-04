"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Keyboard, Mic, Volume2, VolumeX } from "lucide-react";
import { api, rememberJD } from "@/lib/client";
import { AppShell, ErrorBox, PageTitle, PanelCard, PrimaryButton } from "@/components/ui";

type Past = { id: string; created_at: string; length: number; overall_score: number | null; verdict: string | null };
type KitInfo = { kind: "jd" | "role"; company: string; role: string };

const LENGTHS = [
  { n: 5, label: "Quick", time: "about 12 min" },
  { n: 8, label: "Standard", time: "about 20 min" },
  { n: 10, label: "Full", time: "about 25 min" },
];
const TIMES = [120, 180, 240];

/** Set up a mock interview for one JD or role kit, and see past ones. */
export default function MockSetupPage() {
  const { jdId } = useParams<{ jdId: string }>();
  const router = useRouter();
  const [kit, setKit] = useState<KitInfo | null>(null);
  const [past, setPast] = useState<Past[] | null>(null);
  const [length, setLength] = useState(8);
  const [seconds, setSeconds] = useState(180);
  const [mode, setMode] = useState<"voice" | "typed">("voice");
  const [readAloud, setReadAloud] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rememberJD(jdId);
    api<{ jd: KitInfo }>(`/api/kit/${jdId}/concepts`)
      .then((r) => setKit(r.jd))
      .catch(() => undefined);
    api<{ mocks: Past[] }>(`/api/mock?jdId=${encodeURIComponent(jdId)}`)
      .then((r) => setPast(r.mocks))
      .catch(() => setPast([]));
  }, [jdId]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>("/api/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdId, length, seconds }),
      });
      router.push(`/mock/session/${r.id}?mode=${mode}&voice=${readAloud ? 1 : 0}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const option = (active: boolean) =>
    `flex min-h-[64px] flex-1 flex-col items-start justify-center rounded-[20px] px-4 py-2.5 text-left transition ${
      active ? "bg-ink text-white" : "bg-white text-ink hover:bg-ground"
    }`;

  const panel = (
    <>
      <PanelCard title="How it works">
        <ol className="flex flex-col gap-2.5 text-sm">
          <li>1. One question at a time, opening with &ldquo;Tell me about yourself&rdquo;.</li>
          <li>2. Each question has a timer. The interviewer may ask a follow-up.</li>
          <li>3. No feedback until the end, just like the real thing.</li>
          <li>4. Then a full scorecard, with a model answer for every question.</li>
        </ol>
      </PanelCard>
      <PanelCard title="Your past mock interviews">
        {!past ? (
          <p className="text-sm">Loading…</p>
        ) : past.length === 0 ? (
          <p className="text-sm">Your scorecards will appear here.</p>
        ) : (
          <ul className="flex flex-col">
            {past.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/mock/session/${m.id}`}
                  className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl px-2 py-2 no-underline hover:bg-ground"
                >
                  <span>
                    <span className="block text-sm font-semibold">{m.verdict ?? "Scorecard"}</span>
                    <span className="block text-xs text-muted">
                      {m.length} questions · {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  {m.overall_score !== null ? (
                    <span className="rounded-full bg-mint px-2.5 py-1 text-xs font-bold">{m.overall_score}/100</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </>
  );

  return (
    <AppShell active="mock" jdId={jdId} panel={panel}>
      <PageTitle eyebrow={kit ? `Mock interview · ${kit.role}${kit.company ? ` · ${kit.company}` : ""}` : "Mock interview"}>
        Ready when
        <br />
        you are
      </PageTitle>

      <section aria-label="Set up your mock interview" className="mt-8 flex max-w-[760px] flex-col gap-6 rounded-[32px] bg-lavender p-6 md:p-7">
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-[15px] font-semibold">How long?</legend>
          <div className="flex flex-wrap gap-2.5">
            {LENGTHS.map((l) => (
              <button key={l.n} type="button" aria-pressed={length === l.n} onClick={() => setLength(l.n)} className={option(length === l.n)}>
                <span className="text-[15px] font-semibold">
                  {l.label} · {l.n} questions
                </span>
                <span className={`text-[12px] ${length === l.n ? "text-white/75" : "text-muted"}`}>{l.time}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-[15px] font-semibold">Time per question</legend>
          <div className="flex flex-wrap gap-2.5">
            {TIMES.map((t) => (
              <button key={t} type="button" aria-pressed={seconds === t} onClick={() => setSeconds(t)} className={option(seconds === t)}>
                <span className="text-[15px] font-semibold">{t / 60} minutes</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-[15px] font-semibold">How will you answer?</legend>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" aria-pressed={mode === "voice"} onClick={() => setMode("voice")} className={option(mode === "voice")}>
              <span className="flex items-center gap-2 text-[15px] font-semibold">
                <Mic size={16} aria-hidden /> Speaking
              </span>
              <span className={`text-[12px] ${mode === "voice" ? "text-white/75" : "text-muted"}`}>Closest to a real interview</span>
            </button>
            <button type="button" aria-pressed={mode === "typed"} onClick={() => setMode("typed")} className={option(mode === "typed")}>
              <span className="flex items-center gap-2 text-[15px] font-semibold">
                <Keyboard size={16} aria-hidden /> Typing
              </span>
              <span className={`text-[12px] ${mode === "typed" ? "text-white/75" : "text-muted"}`}>When you can&apos;t talk out loud</span>
            </button>
          </div>
        </fieldset>

        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[20px] bg-white px-4 py-2.5">
          <input
            type="checkbox"
            checked={readAloud}
            onChange={(e) => setReadAloud(e.target.checked)}
            className="h-5 w-5 flex-none accent-ink"
          />
          {readAloud ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
          <span className="text-[15px] font-medium">Read each question out loud</span>
        </label>

        {error ? <ErrorBox message={error} onRetry={start} /> : null}
        <div>
          <PrimaryButton onClick={start} disabled={busy} className="min-h-[52px]">
            {busy ? "Preparing your interview…" : "Start the interview →"}
          </PrimaryButton>
        </div>
      </section>
    </AppShell>
  );
}
