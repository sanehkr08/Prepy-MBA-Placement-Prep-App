"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { AppShell, PageTitle, PanelCard, Spinner } from "@/components/ui";

type MockItem = {
  id: string;
  jd_id: string;
  created_at: string;
  length: number;
  overall_score: number | null;
  verdict: string | null;
  kit: { role: string; company: string; kind: "jd" | "role" };
};

const VERDICT_BG: Record<string, string> = {
  "Strong hire signal": "bg-mint",
  "Likely to advance": "bg-mint",
  Borderline: "bg-peach",
  "Needs more practice": "bg-pink",
};

/** All past mock interviews across every prep kit. */
export default function MocksPage() {
  const [mocks, setMocks] = useState<MockItem[] | null>(null);
  useEffect(() => {
    api<{ mocks: MockItem[] }>("/api/mock")
      .then((r) => setMocks(r.mocks))
      .catch(() => setMocks([]));
  }, []);

  const scores = (mocks ?? []).flatMap((m) => (m.overall_score === null ? [] : [m.overall_score]));
  const best = scores.length ? Math.max(...scores) : null;
  const avg = scores.length ? Math.round(scores.reduce((n, s) => n + s, 0) / scores.length) : null;

  const panel = (
    <PanelCard title="At a glance">
      <dl className="grid grid-cols-3 gap-2.5">
        {(
          [
            ["Interviews", mocks?.length ?? 0, "bg-lavender"],
            ["Average", avg ?? "–", "bg-peach"],
            ["Best", best ?? "–", "bg-mint"],
          ] as const
        ).map(([label, n, bg]) => (
          <div key={label} className={`rounded-[20px] p-3 ${bg}`}>
            <dt className="text-[12px] font-semibold">{label}</dt>
            <dd className="text-[26px] font-medium leading-tight">{n}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm">Start a new mock interview from any prep kit.</p>
    </PanelCard>
  );

  return (
    <AppShell active="mocks" nav="home" panel={panel}>
      <PageTitle eyebrow="Your preparation">Mock interviews</PageTitle>
      <p className="mt-3.5 max-w-[640px] text-[17px] text-muted">Every mock interview you have finished, with its scorecard.</p>
      <div className="mt-8 max-w-[760px]">
        {!mocks ? (
          <Spinner label="Loading your interviews…" />
        ) : mocks.length === 0 ? (
          <p className="text-[15px]">
            No mock interviews yet. Open a prep kit from{" "}
            <Link href="/kits" className="font-semibold">
              My prep kits
            </Link>{" "}
            and choose &ldquo;Start a mock interview&rdquo;.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {mocks.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/mock/session/${m.id}`}
                  className="flex min-h-[64px] items-center justify-between gap-4 rounded-[24px] bg-white px-5 py-3 no-underline transition hover:bg-panel"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-semibold">{m.kit.role}</span>
                    <span className="block text-[13px] text-muted">
                      {m.kit.kind === "role" ? "Role prep" : m.kit.company || "Company not given"} · {m.length} questions ·{" "}
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="flex flex-none items-center gap-2">
                    {m.verdict ? (
                      <span className={`hidden rounded-full px-2.5 py-1 text-xs font-bold sm:inline ${VERDICT_BG[m.verdict] ?? "bg-peach"}`}>
                        {m.verdict}
                      </span>
                    ) : null}
                    {m.overall_score !== null ? (
                      <span className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-white">{m.overall_score}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
