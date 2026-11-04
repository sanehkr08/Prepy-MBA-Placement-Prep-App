"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { api, rememberJD } from "@/lib/client";
import { ErrorBox } from "@/components/ui";

const STEPS = [
  "Writing the standard profile for this role",
  "Mapping the role to your resume",
  "Preparing concepts, questions and cases",
];

/** Builds (or reopens) the user's kit for a role, then opens its fit map. */
export function RoleStarter({ name, blurb }: { name: string; blurb: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const started = useRef(false);

  const start = useCallback(async () => {
    setError(null);
    setStep(0);
    try {
      const r = await api<{ id: string; created: boolean }>("/api/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      rememberJD(r.id);
      setStep(1);
      // The fit map is built on arrival there; the prep kit then builds in the background.
      router.replace(`/fit/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [name, router]);

  useEffect(() => {
    // Once per visit, even under React's double-invoked effects in development.
    if (started.current) return;
    started.current = true;
    void Promise.resolve().then(start);
  }, [start]);

  return (
    <section aria-live="polite" className="mt-8 flex max-w-[640px] flex-col gap-5 rounded-[32px] bg-lavender p-6 md:p-7">
      {blurb ? <p className="text-[15px]">Focus: {blurb}.</p> : null}
      {error ? (
        <>
          <ErrorBox message={error} onRetry={start} />
          <Link href="/" className="text-sm font-semibold">
            Back to home
          </Link>
        </>
      ) : (
        <ol className="flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-[15px]">
              <span
                className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${i < step ? "bg-mint" : "bg-white"}`}
              >
                {i < step ? (
                  <Check size={16} aria-hidden />
                ) : i === step ? (
                  <LoaderCircle size={16} className="animate-spin" aria-hidden />
                ) : null}
              </span>
              <span className={i > step ? "text-muted" : ""}>{s}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
