"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, PencilLine } from "lucide-react";
import { api } from "@/lib/client";
import { ProfileSchema, type Profile } from "@/lib/schemas";
import { ProfileEditor, cleanProfile } from "@/components/ProfileEditor";
import { useProfile } from "@/components/hooks";
import {
  ErrorBox,
  IconCircle,
  PrimaryButton,
  SecondaryButton,
  Spinner,
  fieldInput,
  fieldLabel,
} from "@/components/ui";

type Step = "choose" | "upload" | "review";

/** First sign-in: build the profile from a resume, or by typing it in. */
export default function OnboardingPage() {
  const router = useRouter();
  const { profile, loaded } = useProfile();
  const [step, setStep] = useState<Step>("choose");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<Profile | null>(null);
  const [rawText, setRawText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resumeFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ user: { name: string } }>("/api/me")
      .then((r) => setName(r.user.name))
      .catch(() => undefined);
  }, []);

  // Already onboarded: go to the app.
  useEffect(() => {
    if (loaded && profile) router.replace("/");
  }, [loaded, profile, router]);

  async function parseResume() {
    setError(null);
    const form = new FormData();
    const f = resumeFile.current?.files?.[0];
    if (f) form.append("file", f);
    form.append("text", resumeText);
    setBusy(true);
    try {
      const r = await api<{ profile: Profile; raw_text: string }>("/api/resume", { method: "POST", body: form });
      setDraft({ ...r.profile, name: r.profile.name || name });
      setRawText(r.raw_text);
      setStep("review");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    setError(null);
    setBusy(true);
    try {
      await api("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: cleanProfile(draft), raw_text: rawText || undefined }),
      });
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const firstName = name.split(" ")[0];

  return (
    <main className="min-h-screen bg-ground px-4 py-10 md:px-10">
      <div className="mx-auto flex max-w-[880px] flex-col gap-8">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-[22px] font-bold text-white">P</span>
          <span className="text-[22px] font-medium">Prepy</span>
        </div>

        <header>
          <p className="text-sm font-medium text-muted">
            Set up your profile · {step === "review" ? "step 2 of 2" : "step 1 of 2"}
          </p>
          <h1 className="mt-1.5 text-[44px] font-light leading-[1.02] tracking-[-0.02em] md:text-[60px]">
            {step === "review" ? "Check your profile" : `Welcome${firstName ? `, ${firstName}` : ""}.`}
          </h1>
          <p className="mt-3 max-w-[640px] text-[17px] text-muted">
            {step === "review"
              ? "Fix anything that is wrong or missing. Prepy only uses what is saved here when it writes about you."
              : "Prepy builds every answer and practice question from your real background. Start with your resume, or type your details in."}
          </p>
        </header>

        {!loaded ? (
          <Spinner label="Loading…" />
        ) : step === "choose" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setStep("upload")}
              className="flex flex-col items-start gap-3 rounded-[32px] bg-lavender p-6 text-left transition hover:brightness-[0.97]"
            >
              <IconCircle>
                <FileText size={18} strokeWidth={1.7} aria-hidden />
              </IconCircle>
              <span className="text-[24px] font-medium leading-tight">Upload my resume</span>
              <span className="text-sm">
                Recommended. Prepy reads your education, experience, projects and skills, and you check them before saving.
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft({ ...ProfileSchema.parse({}), name });
                setStep("review");
              }}
              className="flex flex-col items-start gap-3 rounded-[32px] bg-peach p-6 text-left transition hover:brightness-[0.97]"
            >
              <IconCircle>
                <PencilLine size={18} strokeWidth={1.7} aria-hidden />
              </IconCircle>
              <span className="text-[24px] font-medium leading-tight">Enter my details</span>
              <span className="text-sm">Type your name, education and experience yourself. You can add a resume later.</span>
            </button>
          </div>
        ) : step === "upload" ? (
          <section aria-label="Upload your resume" className="flex flex-col gap-4 rounded-[32px] bg-lavender p-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ob-file" className={fieldLabel}>
                PDF, DOCX or TXT, up to 5 MB
              </label>
              <input
                id="ob-file"
                ref={resumeFile}
                type="file"
                accept=".pdf,.docx,.txt"
                className="rounded-2xl bg-white/85 p-3 text-sm file:mr-3 file:min-h-[40px] file:rounded-full file:border-0 file:bg-ink file:px-4 file:text-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ob-text" className={fieldLabel}>
                Or paste the text
              </label>
              <textarea id="ob-text" rows={6} className={fieldInput} value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
            </div>
            {error ? <ErrorBox message={error} /> : null}
            <div className="flex flex-wrap gap-3">
              <PrimaryButton onClick={parseResume} disabled={busy}>
                {busy ? "Reading your resume…" : "Read my resume"}
              </PrimaryButton>
              <SecondaryButton onClick={() => setStep("choose")} disabled={busy}>
                Back
              </SecondaryButton>
            </div>
          </section>
        ) : draft ? (
          <section aria-label="Your profile" className="flex flex-col gap-4 rounded-[32px] bg-lavender p-6">
            <ProfileEditor value={draft} onChange={setDraft} />
            {error ? <ErrorBox message={error} /> : null}
            <div className="flex flex-wrap gap-3">
              <PrimaryButton onClick={save} disabled={busy || !draft.name.trim()}>
                {busy ? "Saving…" : "Save and continue"}
              </PrimaryButton>
              <SecondaryButton onClick={() => setStep("choose")} disabled={busy}>
                Back
              </SecondaryButton>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
