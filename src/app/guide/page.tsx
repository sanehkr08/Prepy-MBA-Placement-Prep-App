"use client";

import Link from "next/link";
import { AudioLines, BookOpen, Compass, Mic, ShieldCheck, Target, Users } from "lucide-react";
import { AppShell, IconCircle, PageTitle, PanelCard, primaryLink } from "@/components/ui";

const STEPS = [
  {
    icon: <Compass size={18} strokeWidth={1.7} aria-hidden />,
    title: "1. Pick a role or add a JD",
    text: "On the home page, choose a common role, type any role, or upload a job description. Each becomes a prep kit you can reopen from My prep kits.",
    bg: "bg-lavender",
  },
  {
    icon: <Target size={18} strokeWidth={1.7} aria-hidden />,
    title: "2. See how you fit",
    text: "Every requirement is marked Strong, Partial or Gap, with the line of your resume behind it, and a tip for using it in the interview.",
    bg: "bg-mint",
  },
  {
    icon: <BookOpen size={18} strokeWidth={1.7} aria-hidden />,
    title: "3. Study the prep kit",
    text: "Concepts with Read more notes, likely questions, cases, situational and behavioral questions, and resume and gap questions. Generate More whenever you want more.",
    bg: "bg-peach",
  },
  {
    icon: <Mic size={18} strokeWidth={1.7} aria-hidden />,
    title: "4. Practise",
    text: "Answer any question by typing or speaking. Get scored on structure, relevance, evidence and clarity, then see a model answer built from your resume.",
    bg: "bg-pink",
  },
  {
    icon: <Users size={18} strokeWidth={1.7} aria-hidden />,
    title: "5. Run a mock interview",
    text: "Timed questions read aloud, follow-ups like a real interviewer, and a full scorecard at the end. Your past interviews are in Mock interviews.",
    bg: "bg-white",
  },
];

/** A short guide to Prepy. */
export default function GuidePage() {
  const panel = (
    <>
      <PanelCard title="Ask Prepy">
        <p className="flex gap-3 text-sm">
          <AudioLines size={18} className="mt-0.5 flex-none" aria-hidden />
          The Ask Prepy button at the bottom right of every page opens the voice tutor.
        </p>
      </PanelCard>
      <Link href="/" className={primaryLink}>
        Start preparing
      </Link>
    </>
  );
  return (
    <AppShell active="guide" nav="home" panel={panel}>
      <PageTitle eyebrow="You">How Prepy works</PageTitle>
      <p className="mt-3.5 max-w-[640px] text-[17px] text-muted">
        Interview prep built from your own story, for any role. Five steps from a role or JD to a confident interview.
      </p>
      <ol className="mt-8 flex max-w-[760px] flex-col gap-4">
        {STEPS.map((s) => (
          <li key={s.title} className={`flex gap-4 rounded-[28px] p-5 ${s.bg}`}>
            <IconCircle>{s.icon}</IconCircle>
            <div>
              <h2 className="text-[19px] font-medium">{s.title}</h2>
              <p className="mt-1 text-[15px] leading-relaxed">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="mt-6 flex max-w-[760px] gap-4 rounded-[28px] bg-ink p-5 text-white">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white text-ink">
          <ShieldCheck size={18} strokeWidth={1.7} aria-hidden />
        </span>
        <div>
          <h2 className="text-[19px] font-medium">Prepy never invents your experience</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-[#D8D2CC]">
            Anything written about you comes only from your saved profile. Where a number or detail is missing, you see a
            placeholder like [add metric] to fill in yourself.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
