"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { AppShell, ErrorBox, PageTitle, Spinner, primaryLink } from "@/components/ui";
import { SpeechFeedback, type SpeechView } from "../SpeechFeedback";

/** One past impromptu speech and its feedback. */
export default function SpeechPage() {
  const { id } = useParams<{ id: string }>();
  const [speech, setSpeech] = useState<SpeechView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ speech: SpeechView }>(`/api/impromptu/${id}`)
      .then((r) => setSpeech(r.speech))
      .catch((e: Error) => setError(e.message));
  }, [id]);
  return (
    <AppShell active="impromptu" nav="home">
      <PageTitle eyebrow={`Impromptu speaking${speech ? ` · ${new Date(speech.created_at).toLocaleDateString()}` : ""}`}>
        Your speech
      </PageTitle>
      <div className="mt-8 flex max-w-[900px] flex-col gap-5">
        {error ? <ErrorBox message={error} /> : !speech ? <Spinner label="Loading…" /> : <SpeechFeedback speech={speech} />}
        <div>
          <Link href="/impromptu" className={primaryLink}>
            Try a new topic
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
