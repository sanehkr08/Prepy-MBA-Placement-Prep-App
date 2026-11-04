"use client";

import Link from "next/link";
import { AppShell, PageTitle, PanelCard, primaryLink } from "@/components/ui";
import { JDHistory } from "@/components/JDHistory";

/** Every role and JD the user has prepared, to reopen or delete. */
export default function KitsPage() {
  const panel = (
    <PanelCard title="Start a new one">
      <p className="mb-4 text-sm">Prepare for a common role, type any role, or add a job description from the home page.</p>
      <Link href="/" className={primaryLink}>
        Go to home
      </Link>
    </PanelCard>
  );
  return (
    <AppShell active="kits" nav="home" panel={panel}>
      <PageTitle eyebrow="Your preparation">My prep kits</PageTitle>
      <p className="mt-3.5 max-w-[640px] text-[17px] text-muted">
        Every role and job description you have prepared. Open one to continue with its fit map, prep kit, practice and
        mock interviews.
      </p>
      <div className="mt-8 max-w-[760px]">
        <JDHistory
          hrefFor={(id) => `/kit/${id}`}
          emptyText="Nothing here yet. Pick a role or add a JD on the home page to build your first prep kit."
          rowClass="bg-white hover:bg-panel"
        />
      </div>
    </AppShell>
  );
}
