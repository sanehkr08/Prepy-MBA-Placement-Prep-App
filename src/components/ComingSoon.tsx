"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AppShell, PageTitle, primaryLink } from "./ui";

/** Placeholder for a home-sidebar feature that is planned but not built yet. */
export function ComingSoon({
  active,
  eyebrow,
  title,
  badge,
  intro,
  points,
}: {
  active: ComponentProps<typeof AppShell>["active"];
  eyebrow: string;
  title: string;
  badge: string;
  intro: string;
  points: ReactNode[];
}) {
  return (
    <AppShell active={active} nav="home">
      <span className="mb-3 inline-block rounded-full bg-peach px-2.5 py-1 text-xs font-bold">{badge}</span>
      <PageTitle eyebrow={eyebrow}>{title}</PageTitle>
      <p className="mt-3.5 max-w-[640px] text-[17px] text-muted">{intro}</p>
      <ul className="mt-8 flex max-w-[760px] flex-col gap-3">
        {points.map((p, i) => (
          <li key={i} className="rounded-[24px] bg-white px-5 py-4 text-[15px] leading-relaxed">
            {p}
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Link href="/" className={primaryLink}>
          Back to home
        </Link>
      </div>
    </AppShell>
  );
}
