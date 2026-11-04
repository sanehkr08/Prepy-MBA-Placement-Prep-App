"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, rememberJD } from "@/lib/client";
import { ErrorBox, PrimaryButton, fieldInput, fieldLabel } from "./ui";

/**
 * Add a job description (paste or upload) and go straight to the fit map.
 * Used on the home page. `idPrefix` keeps field ids unique.
 * With `heading`, the title and the Analyse button share the top row; otherwise the button is at the bottom.
 */
export function JDForm({
  idPrefix = "jd",
  rows = 8,
  disabled = false,
  heading,
  intro,
}: {
  idPrefix?: string;
  rows?: number;
  disabled?: boolean;
  heading?: ReactNode;
  intro?: ReactNode;
}) {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasJD = !!text.trim() || !!fileName;

  async function analyse(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const form = new FormData();
    form.append("company", company);
    form.append("role", role);
    form.append("text", text);
    const f = file.current?.files?.[0];
    if (f) form.append("file", f);
    setBusy(true);
    try {
      const r = await api<{ jd: { id: string } }>("/api/jd", { method: "POST", body: form });
      rememberJD(r.jd.id);
      router.push(`/fit/${r.jd.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const id = (name: string) => `${idPrefix}-${name}`;
  const submit = (
    <PrimaryButton type="submit" disabled={disabled || busy || !role.trim() || !hasJD} className="flex-none whitespace-nowrap">
      {busy ? "Reading the JD…" : "Analyse my fit →"}
    </PrimaryButton>
  );
  return (
    <form onSubmit={analyse} className="flex flex-col gap-3.5">
      {heading ? (
        // The button stays top-right beside the title; a long title wraps instead of pushing it down.
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">{heading}</div>
          {submit}
        </div>
      ) : null}
      {intro}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id("file")} className={fieldLabel}>
          Upload the JD (PDF, DOCX or TXT){fileName ? ` · ${fileName}` : ""}
        </label>
        <input
          id={id("file")}
          ref={file}
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          className="rounded-2xl bg-white/85 p-3 text-sm file:mr-3 file:min-h-[40px] file:rounded-full file:border-0 file:bg-ink file:px-4 file:text-white"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("company")} className={fieldLabel}>
            Company
          </label>
          <input id={id("company")} className={fieldInput} value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("role")} className={fieldLabel}>
            Role
          </label>
          <input
            id={id("role")}
            className={fieldInput}
            placeholder="e.g. Area Sales Manager"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id("text")} className={fieldLabel}>
          Or paste the JD text
        </label>
        <textarea id={id("text")} rows={rows} className={fieldInput} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {error ? <ErrorBox message={error} /> : null}
      {heading ? null : <div>{submit}</div>}
    </form>
  );
}
