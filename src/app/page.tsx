"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Briefcase, Upload, User, Trash2 } from "lucide-react";
import { api, rememberJD } from "@/lib/client";
import type { Profile } from "@/lib/schemas";
import { useProfile } from "@/components/hooks";
import { ProfileEditor, cleanProfile } from "@/components/ProfileEditor";
import {
  AppShell,
  PageTitle,
  ProfileBadge,
  PanelCard,
  IconCircle,
  PrimaryButton,
  SecondaryButton,
  ErrorBox,
  Spinner,
  fieldInput,
  fieldLabel,
} from "@/components/ui";

type JDItem = { id: string; company: string; role: string; created_at: string; overall_label: string | null };

export default function SetupPage() {
  const router = useRouter();
  const { profile, setProfile, loaded } = useProfile();
  const [draft, setDraft] = useState<Profile | null>(null);
  const [rawText, setRawText] = useState("");
  const [editing, setEditing] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const resumeFile = useRef<HTMLInputElement>(null);

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jdText, setJdText] = useState("");
  const [jdFileName, setJdFileName] = useState("");
  const jdFile = useRef<HTMLInputElement>(null);
  const [jdBusy, setJdBusy] = useState(false);
  const [jdError, setJdError] = useState<string | null>(null);
  const [jds, setJds] = useState<JDItem[]>([]);

  useEffect(() => {
    api<{ jds: JDItem[] }>("/api/jd")
      .then((r) => setJds(r.jds))
      .catch(() => setJds([]));
  }, []);

  async function parseResume() {
    setProfileError(null);
    const form = new FormData();
    const f = resumeFile.current?.files?.[0];
    if (f) form.append("file", f);
    form.append("text", resumeText);
    setParsing(true);
    try {
      const r = await api<{ profile: Profile; raw_text: string }>("/api/resume", { method: "POST", body: form });
      setDraft(r.profile);
      setRawText(r.raw_text);
      setEditing(true);
    } catch (e) {
      setProfileError((e as Error).message);
    } finally {
      setParsing(false);
    }
  }

  async function saveProfile() {
    if (!draft) return;
    setSaving(true);
    setProfileError(null);
    try {
      const r = await api<{ profile: NonNullable<typeof profile> }>("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: cleanProfile(draft), raw_text: rawText || undefined }),
      });
      setProfile(r.profile);
      setEditing(false);
      setDraft(null);
    } catch (e) {
      setProfileError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function addJD() {
    setJdError(null);
    const form = new FormData();
    form.append("company", company);
    form.append("role", role);
    form.append("text", jdText);
    const f = jdFile.current?.files?.[0];
    if (f) form.append("file", f);
    setJdBusy(true);
    try {
      const r = await api<{ jd: { id: string } }>("/api/jd", { method: "POST", body: form });
      rememberJD(r.jd.id);
      router.push(`/fit/${r.jd.id}`);
    } catch (e) {
      setJdError((e as Error).message);
      setJdBusy(false);
    }
  }

  async function deleteAll() {
    if (!window.confirm("Delete your profile, all job descriptions, prep kits and practice answers? This cannot be undone.")) return;
    await api("/api/data", { method: "DELETE" });
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    setProfile(null);
    setJds([]);
    setDraft(null);
    setEditing(false);
  }

  const showEditor = editing && draft;
  const hasProfile = !!profile;

  const panel = (
    <>
      <ProfileBadge name={profile?.data.name} headline={profile?.data.headline} />
      <PanelCard title="How Prepy works">
        <ol className="flex flex-col gap-3">
          {[
            ["bg-mint", "3", "See how each JD requirement matches you"],
            ["bg-pink", "4", "Study the role: concepts, questions, cases"],
            ["bg-lavender", "5", "Practise by typing or speaking, get scored"],
          ].map(([bg, n, t]) => (
            <li key={n} className="flex items-center gap-3">
              <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full font-bold ${bg}`}>{n}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </PanelCard>
      <PanelCard title="Earlier dossiers">
        {jds.length === 0 ? (
          <p className="text-sm">Your saved job descriptions will appear here.</p>
        ) : (
          <ul className="flex flex-col">
            {jds.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/fit/${j.id}`}
                  onClick={() => rememberJD(j.id)}
                  className="flex min-h-[48px] items-center justify-between gap-3 rounded-2xl px-2 py-2 no-underline hover:bg-ground"
                >
                  <span>
                    <span className="block text-sm font-semibold">{j.role}</span>
                    <span className="block text-xs text-muted">
                      {j.company || "Company not given"} · {new Date(j.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  {j.overall_label ? (
                    <span className="rounded-full bg-peach px-2.5 py-1 text-xs font-bold">{j.overall_label}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
      {hasProfile ? (
        <button
          type="button"
          onClick={deleteAll}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 self-center rounded-full px-4 text-sm font-medium text-muted hover:text-ink"
        >
          <Trash2 size={16} aria-hidden /> Delete all my data
        </button>
      ) : null}
    </>
  );

  return (
    <AppShell active="setup" panel={panel}>
      <PageTitle eyebrow="Steps 1–2 of 5">
        Drop a JD.
        <br />
        See how you fit.
      </PageTitle>
      <p className="mt-3.5 max-w-[640px] text-[17px] text-muted">
        Your resume is read once and saved. Any role works: area sales manager, account executive, business analyst,
        product manager and more.
      </p>

      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-start gap-5">
        {/* Step 1: resume */}
        <section aria-labelledby="resume-h" className="flex flex-col gap-4 rounded-[32px] bg-lavender p-6">
          <div className="flex items-center gap-2.5">
            <IconCircle>
              <User size={18} strokeWidth={1.7} aria-hidden />
            </IconCircle>
            <span className="text-[13px] font-medium">Step 1 · Your resume</span>
          </div>

          {!loaded ? (
            <Spinner label="Loading your profile…" />
          ) : showEditor ? (
            <>
              <h2 id="resume-h" className="text-[28px] font-medium leading-tight tracking-[-0.01em]">
                Check what Prepy understood
              </h2>
              <p className="text-sm">
                Fix anything that is wrong or missing. Prepy only uses what is saved here when it writes about you.
              </p>
              <ProfileEditor value={draft} onChange={setDraft} />
              {profileError ? <ErrorBox message={profileError} /> : null}
              <div className="flex flex-wrap gap-3">
                <PrimaryButton onClick={saveProfile} disabled={saving}>
                  {saving ? "Saving…" : "Save profile"}
                </PrimaryButton>
                <SecondaryButton
                  onClick={() => {
                    setEditing(false);
                    setDraft(null);
                  }}
                >
                  Cancel
                </SecondaryButton>
              </div>
            </>
          ) : hasProfile ? (
            <>
              <h2 id="resume-h" className="text-[28px] font-medium leading-tight tracking-[-0.01em]">
                Profile saved
              </h2>
              <div className="rounded-[20px] bg-white p-4 text-sm">
                <p className="font-semibold">{profile.data.name || "Your profile"}</p>
                <p className="text-muted">{profile.data.headline}</p>
                <p className="mt-2">
                  {profile.data.experience.length} experience entries · {profile.data.education.length} education ·{" "}
                  {profile.data.achievements.length} achievements
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <SecondaryButton
                  onClick={() => {
                    setDraft(profile.data);
                    setEditing(true);
                  }}
                >
                  Edit profile
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => {
                    setDraft(null);
                    setEditing(false);
                    setProfile(null);
                  }}
                >
                  Replace resume
                </SecondaryButton>
              </div>
            </>
          ) : (
            <>
              <h2 id="resume-h" className="text-[28px] font-medium leading-tight tracking-[-0.01em]">
                Upload your resume
              </h2>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="resume-file" className={fieldLabel}>
                  PDF, DOCX or TXT, up to 5 MB
                </label>
                <input
                  id="resume-file"
                  ref={resumeFile}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="rounded-2xl bg-white/85 p-3 text-sm file:mr-3 file:min-h-[40px] file:rounded-full file:border-0 file:bg-ink file:px-4 file:text-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="resume-text" className={fieldLabel}>
                  Or paste the text
                </label>
                <textarea
                  id="resume-text"
                  rows={6}
                  className={fieldInput}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                />
              </div>
              {profileError ? <ErrorBox message={profileError} /> : null}
              <div>
                <PrimaryButton onClick={parseResume} disabled={parsing}>
                  <Upload size={16} aria-hidden />
                  {parsing ? "Reading your resume…" : "Read my resume"}
                </PrimaryButton>
              </div>
            </>
          )}
        </section>

        {/* Step 2: JD */}
        <section aria-labelledby="jd-h" className="flex flex-col gap-4 rounded-[32px] bg-peach p-6">
          <div className="flex items-center gap-2.5">
            <IconCircle>
              <Briefcase size={18} strokeWidth={1.7} aria-hidden />
            </IconCircle>
            <span className="text-[13px] font-medium">Step 2 · Job description</span>
          </div>
          <h2 id="jd-h" className="text-[28px] font-medium leading-tight tracking-[-0.01em]">
            Add the role you are interviewing for
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="company" className={fieldLabel}>
                Company
              </label>
              <input id="company" className={fieldInput} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="role" className={fieldLabel}>
                Role
              </label>
              <input
                id="role"
                className={fieldInput}
                placeholder="e.g. Area Sales Manager"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="jd" className={fieldLabel}>
              Paste the JD
            </label>
            <textarea id="jd" rows={10} className={fieldInput} value={jdText} onChange={(e) => setJdText(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="jd-file" className={fieldLabel}>
              Or upload the JD as a PDF {jdFileName ? `· ${jdFileName}` : ""}
            </label>
            <input
              id="jd-file"
              ref={jdFile}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => setJdFileName(e.target.files?.[0]?.name ?? "")}
              className="rounded-2xl bg-white/85 p-3 text-sm file:mr-3 file:min-h-[40px] file:rounded-full file:border-0 file:bg-ink file:px-4 file:text-white"
            />
          </div>
          {!hasProfile ? <p className="text-sm font-medium">Save your profile first, then add a JD.</p> : null}
          {jdError ? <ErrorBox message={jdError} /> : null}
          <div>
            <PrimaryButton onClick={addJD} disabled={!hasProfile || jdBusy || !role.trim()}>
              {jdBusy ? "Reading the JD…" : "Analyse my fit →"}
            </PrimaryButton>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
