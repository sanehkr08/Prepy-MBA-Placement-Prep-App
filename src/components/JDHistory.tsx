"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api, forgetJD, rememberJD } from "@/lib/client";
import { ConfirmDialog } from "./ui";

export type JDItem = {
  id: string;
  kind: "jd" | "role";
  company: string;
  role: string;
  created_at: string;
  overall_label: string | null;
};

/**
 * The user's earlier JDs, each with a delete button that asks "Are you sure?" first.
 * `hrefFor` picks where a JD opens.
 */
export function JDHistory({
  hrefFor,
  limit,
  title,
  emptyText,
  rowClass = "bg-white hover:bg-ground",
}: {
  hrefFor: (id: string) => string;
  limit?: number;
  title?: string;
  emptyText?: string;
  rowClass?: string;
}) {
  const [jds, setJds] = useState<JDItem[] | null>(null);
  const [pending, setPending] = useState<JDItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ jds: JDItem[] }>("/api/jd")
      .then((r) => setJds(r.jds))
      .catch(() => setJds([]));
  }, []);

  async function confirmDelete() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/jd/${pending.id}`, { method: "DELETE" });
      forgetJD(pending.id);
      setJds((list) => (list ?? []).filter((j) => j.id !== pending.id));
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!jds) return null;
  if (!jds.length) return emptyText ? <p className="text-sm">{emptyText}</p> : null;
  const shown = limit ? jds.slice(0, limit) : jds;

  return (
    <div className="flex flex-col gap-2">
      {title ? <h3 className="text-[13px] font-semibold">{title}</h3> : null}
      <ul className="flex flex-col gap-2">
        {shown.map((j) => (
          <li key={j.id} className={`flex items-center gap-1 rounded-[20px] pr-1.5 transition ${rowClass}`}>
            <Link
              href={hrefFor(j.id)}
              onClick={() => rememberJD(j.id)}
              className="flex min-h-[56px] min-w-0 flex-1 items-center justify-between gap-3 py-2.5 pl-4 no-underline"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{j.role}</span>
                <span className="block text-[12px] text-muted">
                  {j.kind === "role" ? "Role prep" : j.company || "Company not given"} · added{" "}
                  {new Date(j.created_at).toLocaleDateString()}
                </span>
              </span>
              {j.overall_label ? (
                <span className="flex-none rounded-full bg-peach px-2.5 py-1 text-xs font-bold">{j.overall_label} fit</span>
              ) : null}
            </Link>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPending(j);
              }}
              aria-label={`Delete ${j.role}${j.company ? ` at ${j.company}` : ""}`}
              title="Delete this JD"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-muted transition hover:bg-pink hover:text-ink"
            >
              <Trash2 size={17} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {pending ? (
        <ConfirmDialog
          title="Are you sure?"
          message={
            <p>
              This deletes <strong className="font-semibold">{pending.role}</strong>
              {pending.company ? ` at ${pending.company}` : ""} with its fit map, prep kit and practice answers. This
              cannot be undone.
            </p>
          }
          confirmLabel="Yes, delete it"
          busy={busy}
          error={error}
          onConfirm={confirmDelete}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}
