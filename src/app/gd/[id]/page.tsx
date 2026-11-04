"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { AppShell, ErrorBox, PageTitle, Spinner, primaryLink } from "@/components/ui";
import { GDFeedback, type GDView } from "../GDFeedback";

/** One past group discussion and its feedback. */
export default function PastGDPage() {
  const { id } = useParams<{ id: string }>();
  const [gd, setGd] = useState<GDView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ gd: GDView }>(`/api/gd/${id}`)
      .then((r) => setGd(r.gd))
      .catch((e: Error) => setError(e.message));
  }, [id]);
  return (
    <AppShell active="gd" nav="home">
      <PageTitle eyebrow={`Group discussion${gd ? ` · ${new Date(gd.created_at).toLocaleDateString()}` : ""}`}>Your discussion</PageTitle>
      <div className="mt-8 flex max-w-[900px] flex-col gap-5">
        {error ? (
          <ErrorBox message={error} />
        ) : !gd ? (
          <Spinner label="Loading…" />
        ) : gd.result ? (
          <GDFeedback gd={gd} />
        ) : (
          <p className="text-[15px]">This discussion was not finished, so it has no feedback.</p>
        )}
        <div>
          <Link href="/gd" className={primaryLink}>
            New discussion
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
