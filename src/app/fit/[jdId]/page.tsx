"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Check, LayoutGrid, X, CircleDashed, Briefcase, RefreshCw } from "lucide-react";
import { api, rememberJD } from "@/lib/client";
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
  primaryLink,
} from "@/components/ui";

type FitItem = {
  requirement: string;
  kind: string;
  label: "Strong" | "Partial" | "Gap";
  evidence: string;
  source_ref: string | null;
  source_label: string | null;
  tip: string;
};
type FitResponse = {
  jd: { id: string; company: string; role: string; role_family: string };
  fit: { items: FitItem[]; counts: { Strong: number; Partial: number; Gap: number }; overall_label: string };
};

const cardBg = { Strong: "bg-mint", Partial: "bg-peach", Gap: "bg-pink" } as const;

export default function FitPage() {
  const { jdId } = useParams<{ jdId: string }>();
  const { profile } = useProfile();
  const [data, setData] = useState<FitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | "Strong" | "Partial" | "Gap">("All");

  const load = useCallback(
    (refresh = false) => {
      setError(null);
      setData(null);
      api<FitResponse>(`/api/fit/${jdId}${refresh ? "?refresh=1" : ""}`)
        .then(setData)
        .catch((e: Error) => setError(e.message));
    },
    [jdId],
  );

  useEffect(() => {
    rememberJD(jdId);
    void Promise.resolve().then(() => load());
  }, [jdId, load]);

  const items = data?.fit.items.filter((i) => filter === "All" || i.label === filter) ?? [];
  const c = data?.fit.counts;
  const total = data?.fit.items.length ?? 0;

  const panel = (
    <>
      <ProfileBadge name={profile?.data.name} headline={profile?.data.headline} />
      {data && c ? (
        <PanelCard
          title={
            <span className="flex items-center justify-between">
              Fit summary
              <span className="rounded-full bg-peach px-2.5 py-1 text-xs font-bold text-ink">{data.fit.overall_label} fit</span>
            </span>
          }
        >
          <p className="mb-3.5 text-[32px] font-medium leading-none">
            {c.Strong} <span className="text-[15px] font-normal text-muted">of {total} strong</span>
          </p>
          <div aria-hidden className="flex h-[120px] items-end gap-1.5">
            {(
              [
                ["Strong", "bg-mint"],
                ["Partial", "bg-peach"],
                ["Gap", "bg-pink"],
              ] as const
            ).map(([k, bg]) => (
              <span
                key={k}
                className={`rounded-[14px] ${bg}`}
                style={{ flex: Math.max(c[k], 0.4), height: `${Math.max(15, (c[k] / Math.max(total, 1)) * 100)}%` }}
              />
            ))}
          </div>
          <ul className="mt-3 flex justify-between text-xs">
            <li>Strong {c.Strong}</li>
            <li>Partial {c.Partial}</li>
            <li>Gap {c.Gap}</li>
          </ul>
        </PanelCard>
      ) : null}
      {data ? (
        <PanelCard dark>
          <p className="text-xl font-medium leading-snug">
            {c && c.Gap + c.Partial > 0
              ? `Your ${c.Gap} gaps and ${c.Partial} partials now lead your prep kit`
              : "Your prep kit is ready to build"}
          </p>
          <p className="mb-4 mt-2 text-[13px] text-[#D8D2CC]">Concepts, questions and cases for this role.</p>
          <Link href={`/kit/${jdId}`} className="inline-flex min-h-[44px] items-center rounded-full bg-white px-5 text-sm font-semibold text-ink no-underline">
            Open prep kit →
          </Link>
        </PanelCard>
      ) : null}
      <Link href="/" className="inline-flex min-h-[44px] items-center self-center text-sm font-medium">
        Edit profile or add another JD
      </Link>
    </>
  );

  return (
    <AppShell active="fit" jdId={jdId} panel={panel}>
      <PageTitle eyebrow={`Step 3 of 5${data?.jd.company ? ` · ${data.jd.company}` : ""}`}>
        How you fit
        <br />
        {data?.jd.role ?? "…"}
      </PageTitle>

      {error ? (
        <div className="mt-8">
          <ErrorBox message={error} onRetry={() => load()} />
        </div>
      ) : !data ? (
        <div className="mt-8">
          <SkeletonCards count={6} label="Matching every JD requirement to your resume…" />
        </div>
      ) : (
        <>
          <div className="mt-7 flex flex-wrap gap-3" role="group" aria-label="Filter requirements">
            <PillChip active={filter === "All"} onClick={() => setFilter("All")} icon={<LayoutGrid size={18} />}>
              All {total}
            </PillChip>
            <PillChip active={filter === "Strong"} onClick={() => setFilter("Strong")} iconBg="bg-mint" icon={<Check size={18} />}>
              Strong {c?.Strong}
            </PillChip>
            <PillChip active={filter === "Partial"} onClick={() => setFilter("Partial")} iconBg="bg-peach" icon={<CircleDashed size={18} />}>
              Partial {c?.Partial}
            </PillChip>
            <PillChip active={filter === "Gap"} onClick={() => setFilter("Gap")} iconBg="bg-pink" icon={<X size={18} />}>
              Gaps {c?.Gap}
            </PillChip>
          </div>

          <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium">JD requirements, matched to your resume</h2>
            <button
              type="button"
              onClick={() => load(true)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 text-sm font-medium text-muted hover:text-ink"
            >
              <RefreshCw size={15} aria-hidden /> Re-run match
            </button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
            {items.map((it, i) => (
              <article key={i} className={`flex min-h-[230px] flex-col gap-3 rounded-[32px] p-6 ${cardBg[it.label]}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2.5 text-[13px] font-medium">
                    <IconCircle>
                      <Briefcase size={18} strokeWidth={1.6} aria-hidden />
                    </IconCircle>
                    {it.kind}
                  </span>
                  <Badge>{it.label}</Badge>
                </div>
                <h3 className="mt-1 text-2xl font-medium leading-tight tracking-[-0.01em]">{it.requirement}</h3>
                <p className="text-sm">{it.evidence}</p>
                {it.source_label ? <p className="text-xs font-semibold text-[#3B3836]">Source · {it.source_label}</p> : null}
                {it.tip ? <p className="mt-auto rounded-2xl bg-white/70 px-3.5 py-2.5 text-[13px]">{it.tip}</p> : null}
              </article>
            ))}
          </div>
          <div className="mt-8">
            <Link href={`/kit/${jdId}`} className={primaryLink}>
              Open role prep kit →
            </Link>
          </div>
        </>
      )}
    </AppShell>
  );
}
