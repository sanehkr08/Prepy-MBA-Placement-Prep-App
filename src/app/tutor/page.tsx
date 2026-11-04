"use client";

import Link from "next/link";
import { CircleHelp, Users, Lightbulb, AudioLines } from "lucide-react";
import { AppShell, PageTitle, PanelCard, primaryLink } from "@/components/ui";

const MODES = [
  { icon: <CircleHelp size={18} />, title: "Ask anything", text: "Explain a concept, a case or a JD term out loud.", bg: "bg-pink" },
  { icon: <Users size={18} />, title: "Mock interview", text: "Prepy asks questions aloud, listens, and follows up like an interviewer.", bg: "bg-peach" },
  { icon: <Lightbulb size={18} />, title: "Concept quiz", text: "Quick spoken quizzes from your prep kit.", bg: "bg-lavender" },
  { icon: <AudioLines size={18} />, title: "Delivery coaching", text: "Feedback on pace, filler words, length and confidence.", bg: "bg-mint" },
];

/** v1 feature placeholder (see PRD US-17). */
export default function TutorPage() {
  const panel = (
    <PanelCard title="Available now">
      <p className="mb-4 text-sm">You can already speak your answers in Practice. Prepy transcribes them and scores them.</p>
      <Link href="/" className={primaryLink}>
        Go to your prep
      </Link>
    </PanelCard>
  );
  return (
    <AppShell active="tutor" panel={panel}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-full bg-peach px-2.5 py-1 text-xs font-bold">Coming in v1</span>
      </div>
      <PageTitle>Ask Prepy</PageTitle>
      <p className="mt-3.5 max-w-[640px] text-[17px] text-muted">
        A voice tutor that knows your profile, the JD and your prep kit. It answers your questions, runs spoken mock
        interviews, quizzes you, and coaches your delivery.
      </p>
      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {MODES.map((m) => (
          <article key={m.title} className={`flex flex-col gap-3 rounded-[28px] p-6 ${m.bg}`}>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white">{m.icon}</span>
            <h2 className="text-[22px] font-medium">{m.title}</h2>
            <p className="text-sm">{m.text}</p>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
