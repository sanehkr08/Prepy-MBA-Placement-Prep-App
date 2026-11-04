"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Award, Briefcase, FolderKanban, GraduationCap, Heart, PencilLine, Sparkles, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/client";
import type { Profile } from "@/lib/schemas";
import { useProfile } from "@/components/hooks";
import { ProfileEditor, cleanProfile } from "@/components/ProfileEditor";
import {
  AppShell,
  PageTitle,
  PanelCard,
  IconCircle,
  PrimaryButton,
  SecondaryButton,
  ErrorBox,
  Spinner,
  fieldInput,
  fieldLabel,
} from "@/components/ui";

type Mode = "view" | "edit" | "upload";

/** One titled block of the profile (Education, Experience, …). */
function Section({
  title,
  icon,
  count,
  bg,
  onEdit,
  children,
}: {
  title: string;
  icon: ReactNode;
  count?: number;
  bg: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  const id = `sec-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-4 rounded-[32px] p-6 ${bg}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-3 text-[22px] font-medium">
          <IconCircle>{icon}</IconCircle>
          {title}
          {count ? <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[13px] font-semibold">{count}</span> : null}
        </h2>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${title.toLowerCase()}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold hover:bg-white/60"
        >
          <PencilLine size={15} aria-hidden /> Edit
        </button>
      </div>
      {children}
    </section>
  );
}

const Empty = ({ what }: { what: string }) => <p className="text-sm text-muted">No {what} added yet.</p>;

/** Your profile: see what Prepy knows about you, edit it, or replace it from a new resume. */
export default function ProfilePage() {
  const router = useRouter();
  const { profile, setProfile, loaded } = useProfile();
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState<Profile | null>(null);
  const [rawText, setRawText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resumeFile = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    api<{ user: { email: string } }>("/api/me")
      .then((r) => setEmail(r.user.email))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (loaded && !profile) router.replace("/onboarding");
  }, [loaded, profile, router]);

  function startEdit() {
    if (!profile) return;
    setDraft(profile.data);
    setRawText("");
    setError(null);
    setMode("edit");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function parseResume() {
    setError(null);
    const form = new FormData();
    const f = resumeFile.current?.files?.[0];
    if (f) form.append("file", f);
    form.append("text", resumeText);
    setBusy(true);
    try {
      const r = await api<{ profile: Profile; raw_text: string }>("/api/resume", { method: "POST", body: form });
      setDraft(r.profile);
      setRawText(r.raw_text);
      setMode("edit");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ profile: NonNullable<typeof profile> }>("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: cleanProfile(draft), raw_text: rawText || undefined }),
      });
      setProfile(r.profile);
      setMode("view");
      setDraft(null);
      setRawText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    if (!window.confirm("Delete your profile, all job descriptions, prep kits and practice answers? This cannot be undone.")) return;
    await api("/api/data", { method: "DELETE" });
    try {
      localStorage.clear();
    } catch {
      /* storage unavailable */
    }
    router.replace("/onboarding");
  }

  const p = profile?.data;
  const updated = profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString() : "";

  const panel = (
    <>
      <PanelCard title="At a glance">
        {p ? (
          <dl className="grid grid-cols-2 gap-3">
            {(
              [
                ["Education", p.education.length, "bg-mint"],
                ["Experience", p.experience.length, "bg-peach"],
                ["Projects", p.projects.length, "bg-pink"],
                ["Skills", p.skills.length, "bg-lavender"],
              ] as const
            ).map(([label, n, bg]) => (
              <div key={label} className={`rounded-[20px] p-3 ${bg}`}>
                <dt className="text-[12px] font-semibold">{label}</dt>
                <dd className="text-[28px] font-medium leading-tight">{n}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </PanelCard>
      <PanelCard title="Why it matters">
        <p className="text-sm">
          Prepy writes answer outlines, model answers and practice questions only from what is saved here. Keep it accurate
          and complete.
        </p>
      </PanelCard>
      <button
        type="button"
        onClick={deleteAll}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 self-center rounded-full px-4 text-sm font-medium text-muted hover:text-ink"
      >
        <Trash2 size={16} aria-hidden /> Delete all my data
      </button>
    </>
  );

  return (
    <AppShell active="profile" nav="home" panel={panel}>
      <PageTitle eyebrow="Your profile">{mode === "view" ? "What Prepy knows about you" : "Update your profile"}</PageTitle>

      {!loaded || !p ? (
        <div className="mt-8">
          <Spinner label="Loading your profile…" />
        </div>
      ) : mode === "edit" && draft ? (
        <section aria-label="Edit profile" className="mt-8 flex max-w-[860px] flex-col gap-4 rounded-[32px] bg-lavender p-6">
          <p className="text-sm">Fix anything that is wrong or missing, then save.</p>
          <ProfileEditor value={draft} onChange={setDraft} />
          {error ? <ErrorBox message={error} /> : null}
          <div className="flex flex-wrap gap-3">
            <PrimaryButton onClick={save} disabled={busy || !draft.name.trim()}>
              {busy ? "Saving…" : "Save profile"}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setMode("view");
                setDraft(null);
                setError(null);
              }}
              disabled={busy}
            >
              Cancel
            </SecondaryButton>
          </div>
        </section>
      ) : mode === "upload" ? (
        <section aria-label="Replace from a new resume" className="mt-8 flex max-w-[860px] flex-col gap-4 rounded-[32px] bg-lavender p-6">
          <h2 className="text-[22px] font-medium">Replace from a new resume</h2>
          <p className="text-sm">Prepy reads the new resume and shows it for review. Nothing changes until you save.</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pr-file" className={fieldLabel}>
              PDF, DOCX or TXT, up to 5 MB
            </label>
            <input
              id="pr-file"
              ref={resumeFile}
              type="file"
              accept=".pdf,.docx,.txt"
              className="rounded-2xl bg-white/85 p-3 text-sm file:mr-3 file:min-h-[40px] file:rounded-full file:border-0 file:bg-ink file:px-4 file:text-white"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pr-text" className={fieldLabel}>
              Or paste the text
            </label>
            <textarea id="pr-text" rows={6} className={fieldInput} value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
          </div>
          {error ? <ErrorBox message={error} /> : null}
          <div className="flex flex-wrap gap-3">
            <PrimaryButton onClick={parseResume} disabled={busy}>
              <Upload size={16} aria-hidden />
              {busy ? "Reading your resume…" : "Read my resume"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setMode("view")} disabled={busy}>
              Cancel
            </SecondaryButton>
          </div>
        </section>
      ) : (
        <div className="mt-8 flex max-w-[900px] flex-col gap-5">
          {/* Header: who you are */}
          <section aria-label="About you" className="flex flex-wrap items-center gap-5 rounded-[32px] bg-ink p-6 text-white md:p-7">
            <span aria-hidden className="flex h-[76px] w-[76px] flex-none items-center justify-center rounded-full bg-lavender text-3xl font-semibold text-ink">
              {(p.name || "?").trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-[1_1_260px]">
              <p className="text-[30px] font-medium leading-tight tracking-[-0.01em]">{p.name || "Your name"}</p>
              {p.headline ? <p className="mt-1 text-[15px] text-[#D8D2CC]">{p.headline}</p> : null}
              <p className="mt-2 text-[13px] text-[#D8D2CC]">
                {email}
                {updated ? ` · updated ${updated}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink hover:bg-ground"
              >
                <PencilLine size={15} aria-hidden /> Edit profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("upload");
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-white/10"
              >
                <Upload size={15} aria-hidden /> New resume
              </button>
            </div>
          </section>

          <Section title="Experience" icon={<Briefcase size={18} strokeWidth={1.7} aria-hidden />} count={p.experience.length} bg="bg-peach" onEdit={startEdit}>
            {p.experience.length ? (
              <ol className="flex flex-col gap-3">
                {p.experience.map((e, i) => (
                  <li key={i} className="rounded-[24px] bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[18px] font-semibold leading-snug">{e.title || "Role"}</h3>
                        {e.company ? <p className="text-[15px] text-muted">{e.company}</p> : null}
                      </div>
                      {e.dates ? <span className="flex-none rounded-full bg-peach px-3 py-1 text-[12px] font-semibold">{e.dates}</span> : null}
                    </div>
                    {e.bullets.length ? (
                      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed">
                        {e.bullets.map((b, k) => (
                          <li key={k}>{b}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <Empty what="experience" />
            )}
          </Section>

          <Section title="Education" icon={<GraduationCap size={18} strokeWidth={1.7} aria-hidden />} count={p.education.length} bg="bg-mint" onEdit={startEdit}>
            {p.education.length ? (
              <ol className="flex flex-col gap-3">
                {p.education.map((e, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-[24px] bg-white p-5">
                    <div>
                      <h3 className="text-[17px] font-semibold leading-snug">{e.degree || "Degree"}</h3>
                      {e.institution ? <p className="text-[15px] text-muted">{e.institution}</p> : null}
                    </div>
                    {e.years ? <span className="flex-none rounded-full bg-mint px-3 py-1 text-[12px] font-semibold">{e.years}</span> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <Empty what="education" />
            )}
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Skills" icon={<Sparkles size={18} strokeWidth={1.7} aria-hidden />} count={p.skills.length} bg="bg-lavender" onEdit={startEdit}>
              {p.skills.length ? (
                <ul className="flex flex-wrap gap-2">
                  {p.skills.map((s, i) => (
                    <li key={i} className="rounded-full bg-white px-3.5 py-1.5 text-[14px] font-medium">
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty what="skills" />
              )}
            </Section>

            <Section title="Interests" icon={<Heart size={18} strokeWidth={1.7} aria-hidden />} count={p.interests.length} bg="bg-panel" onEdit={startEdit}>
              {p.interests.length ? (
                <ul className="flex flex-wrap gap-2">
                  {p.interests.map((s, i) => (
                    <li key={i} className="rounded-full bg-white px-3.5 py-1.5 text-[14px] font-medium">
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty what="interests" />
              )}
            </Section>
          </div>

          <Section title="Achievements" icon={<Award size={18} strokeWidth={1.7} aria-hidden />} count={p.achievements.length} bg="bg-pink" onEdit={startEdit}>
            {p.achievements.length ? (
              <ul className="flex flex-col gap-2.5">
                {p.achievements.map((a, i) => (
                  <li key={i} className="flex gap-3 rounded-[20px] bg-white px-4 py-3 text-[14px] leading-relaxed">
                    <Award size={16} className="mt-0.5 flex-none" aria-hidden />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty what="achievements" />
            )}
          </Section>

          <Section title="Projects" icon={<FolderKanban size={18} strokeWidth={1.7} aria-hidden />} count={p.projects.length} bg="bg-white" onEdit={startEdit}>
            {p.projects.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {p.projects.map((pr, i) => (
                  <li key={i} className="rounded-[24px] bg-ground p-4">
                    <h3 className="text-[16px] font-semibold">{pr.name || "Project"}</h3>
                    {pr.description ? <p className="mt-1 text-[14px] leading-relaxed">{pr.description}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty what="projects" />
            )}
          </Section>
        </div>
      )}
    </AppShell>
  );
}
