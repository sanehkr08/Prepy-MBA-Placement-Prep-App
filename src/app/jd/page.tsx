"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Briefcase } from "lucide-react";
import { useProfile } from "@/components/hooks";
import {
  AppShell,
  PageTitle,
  ProfileBadge,
  PanelCard,
  IconCircle,
} from "@/components/ui";
import { JDForm } from "@/components/JDForm";
import { JDHistory } from "@/components/JDHistory";

/** Prepare for your JD: add a job description, or reopen an earlier one. */
export default function JDPage() {
  const router = useRouter();
  const { profile, loaded } = useProfile();

  useEffect(() => {
    if (loaded && !profile) router.replace("/onboarding");
  }, [loaded, profile, router]);

  const panel = (
    <>
      <ProfileBadge name={profile?.data.name} headline={profile?.data.headline} />
      <Link href="/profile" className="inline-flex min-h-[44px] items-center self-center text-sm font-semibold">
        View or edit your profile
      </Link>
      <PanelCard title="Your earlier JDs">
        <JDHistory
          hrefFor={(id) => `/fit/${id}`}
          emptyText="The job descriptions you add will appear here."
          rowClass="bg-white hover:bg-ground"
        />
      </PanelCard>
      <PanelCard title="How it works">
        <ol className="flex flex-col gap-3">
          {[
            ["bg-mint", "2", "See how each JD requirement matches you"],
            ["bg-pink", "3", "Study the role: concepts, questions, cases"],
            ["bg-lavender", "4", "Practise by typing or speaking, get scored"],
          ].map(([bg, n, t]) => (
            <li key={n} className="flex items-center gap-3">
              <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full font-bold ${bg}`}>{n}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </PanelCard>
    </>
  );

  return (
    <AppShell active="setup" panel={panel}>
      <PageTitle eyebrow="Prepare for your JD · step 1 of 4">
        Drop a JD.
        <br />
        See how you fit.
      </PageTitle>
      <p className="mt-3.5 max-w-[640px] text-[17px] text-muted">
        Any role works: area sales manager, account executive, business analyst, product manager and more.
      </p>

      <section aria-labelledby="jd-h" className="mt-8 flex max-w-[760px] flex-col gap-4 rounded-[32px] bg-peach p-6">
        <div className="flex items-center gap-2.5">
          <IconCircle>
            <Briefcase size={18} strokeWidth={1.7} aria-hidden />
          </IconCircle>
          <span className="text-[13px] font-medium">Job description</span>
        </div>
        <h2 id="jd-h" className="text-[28px] font-medium leading-tight tracking-[-0.01em]">
          Add the role you are interviewing for
        </h2>
        <JDForm idPrefix="jdp" rows={10} disabled={!profile} />
      </section>
    </AppShell>
  );
}
