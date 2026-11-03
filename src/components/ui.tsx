"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { FileText, Target, BookOpen, Mic, AudioLines, LoaderCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { lastJD } from "@/lib/client";

export type Pastel = "pink" | "peach" | "lavender" | "mint" | "white";

export const pastelBg: Record<Pastel, string> = {
  pink: "bg-pink",
  peach: "bg-peach",
  lavender: "bg-lavender",
  mint: "bg-mint",
  white: "bg-white",
};

type RailKey = "setup" | "fit" | "kit" | "practice" | "tutor";

function RailLink({
  href,
  label,
  active,
  disabled,
  children,
  accent,
}: {
  href: string;
  label: string;
  active: boolean;
  disabled?: boolean;
  children: ReactNode;
  accent?: boolean;
}) {
  const base = "flex h-[52px] w-[52px] items-center justify-center rounded-full transition";
  const tone = active ? "bg-ink text-white" : accent ? "bg-peach text-ink" : "bg-white text-ink hover:bg-panel";
  if (disabled) {
    return (
      <span
        aria-label={`${label} (add a JD first)`}
        title={`${label}: add a JD first`}
        className={`${base} bg-white/60 text-muted`}
      >
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} title={label} aria-current={active ? "page" : undefined} className={`${base} ${tone}`}>
      {children}
    </Link>
  );
}

/** The page's JD, or the last opened one (read after mount: localStorage is not on the server). */
function useStepJD(jdId?: string | null) {
  const [fallback, setFallback] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!jdId) setFallback(lastJD());
  }, [jdId]);
  return jdId ?? fallback;
}

export function SideRail({ active, jdId }: { active: RailKey; jdId?: string | null }) {
  const id = useStepJD(jdId);
  return (
    <nav aria-label="Prep steps" className="flex flex-row items-center gap-3 px-4 pt-6 md:w-[88px] md:flex-none md:flex-col md:px-0 md:pt-7">
      <Link
        href="/"
        aria-label="Prepy home"
        className="mr-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-[22px] font-bold text-white md:mr-0 md:mb-4"
      >
        P
      </Link>
      <RailLink href="/" label="Resume and JD" active={active === "setup"}>
        <FileText size={22} strokeWidth={1.6} />
      </RailLink>
      <RailLink href={`/fit/${id}`} label="Fit and gap map" active={active === "fit"} disabled={!id}>
        <Target size={22} strokeWidth={1.6} />
      </RailLink>
      <RailLink href={`/kit/${id}`} label="Role prep kit" active={active === "kit"} disabled={!id}>
        <BookOpen size={22} strokeWidth={1.6} />
      </RailLink>
      <RailLink href={`/practice/${id}`} label="Practice" active={active === "practice"} disabled={!id}>
        <Mic size={22} strokeWidth={1.6} />
      </RailLink>
      <span className="md:mt-2" />
      <RailLink href="/tutor" label="Talk to Prepy (voice tutor)" active={active === "tutor"} accent>
        <AudioLines size={22} strokeWidth={1.6} />
      </RailLink>
    </nav>
  );
}

const STEPS: { key: RailKey; label: string; href: (id: string) => string }[] = [
  { key: "setup", label: "Resume and JD", href: () => "/" },
  { key: "fit", label: "Fit map", href: (id) => `/fit/${id}` },
  { key: "kit", label: "Prep kit", href: (id) => `/kit/${id}` },
  { key: "practice", label: "Practice", href: (id) => `/practice/${id}` },
];

/** Back / Next buttons between the steps of the flow. */
export function StepNav({ active, jdId }: { active: RailKey; jdId?: string | null }) {
  const id = useStepJD(jdId);
  const i = STEPS.findIndex((s) => s.key === active);
  if (i === -1) return null;
  const back = STEPS[i - 1];
  // Every step after setup needs a JD.
  const next = id ? STEPS[i + 1] : undefined;
  const pill = "inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition";
  return (
    <nav aria-label="Step navigation" className="mb-6 flex flex-wrap items-center justify-between gap-3">
      {back ? (
        <Link href={back.href(id ?? "")} className={`${pill} bg-white text-ink hover:bg-panel`}>
          <ArrowLeft size={16} aria-hidden /> Back: {back.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href(id!)} className={`${pill} bg-ink text-white hover:bg-black`}>
          Next: {next.label} <ArrowRight size={16} aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}

export function AppShell({
  active,
  jdId,
  panel,
  children,
}: {
  active: RailKey;
  jdId?: string | null;
  panel?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-ground md:flex-row md:flex-wrap">
      <SideRail active={active} jdId={jdId} />
      <main className="min-w-0 flex-[999_1_560px] px-5 pb-16 pt-8 md:px-8 md:pt-10">
        <StepNav active={active} jdId={jdId} />
        {children}
      </main>
      {panel ? (
        <aside className="m-4 flex min-w-0 flex-[1_1_320px] flex-col gap-4 self-start rounded-[40px] bg-panel px-6 py-7 md:my-5 md:ml-0 md:mr-5">
          {panel}
        </aside>
      ) : null}
    </div>
  );
}

export function PageTitle({ eyebrow, children }: { eyebrow?: ReactNode; children: ReactNode }) {
  return (
    <header>
      {eyebrow ? <p className="text-sm font-medium text-muted">{eyebrow}</p> : null}
      <h1 className="mt-1.5 text-[44px] font-light leading-[1.02] tracking-[-0.02em] md:text-[68px]">{children}</h1>
    </header>
  );
}

export function ProfileBadge({ name, headline }: { name?: string; headline?: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span aria-hidden className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-lavender text-3xl font-semibold">
        {initial}
      </span>
      <p className="text-[26px] font-medium">{name || "Your profile"}</p>
      {headline ? <p className="text-[13px] text-muted">{headline}</p> : null}
    </div>
  );
}

export function PanelCard({ title, children, dark }: { title?: ReactNode; children: ReactNode; dark?: boolean }) {
  return (
    <section className={`rounded-[28px] p-5 ${dark ? "bg-ink text-white" : "bg-white"}`}>
      {title ? <h2 className={`mb-3 text-sm font-medium ${dark ? "text-[#D8D2CC]" : "text-muted"}`}>{title}</h2> : null}
      {children}
    </section>
  );
}

export function PillChip({
  active,
  icon,
  children,
  onClick,
  iconBg = "bg-white",
}: {
  active?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  iconBg?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-[52px] items-center gap-2.5 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-5 text-sm font-semibold transition ${
        active ? "bg-ink text-white" : "bg-panel text-ink hover:bg-[#e6dcd4]"
      } ${icon ? "" : "pl-5"}`}
    >
      {icon ? (
        <span className={`flex h-10 w-10 items-center justify-center rounded-full text-ink ${active ? "bg-white" : iconBg}`}>
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

export function IconCircle({ children }: { children: ReactNode }) {
  return <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white">{children}</span>;
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold">{children}</span>;
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-ink transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export const primaryLink =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white no-underline transition hover:bg-black";

export function Spinner({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm font-medium text-muted">
      <LoaderCircle size={18} className="animate-spin" aria-hidden />
      {label}
    </p>
  );
}

export function SkeletonCards({ count = 4, label }: { count?: number; label: string }) {
  return (
    <div>
      <Spinner label={label} />
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`skeleton h-[200px] rounded-[32px] ${["bg-pink", "bg-peach", "bg-lavender", "bg-mint"][i % 4]}`} />
        ))}
      </div>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-pink px-5 py-4">
      <p className="text-sm font-medium">{message}</p>
      {onRetry ? <SecondaryButton onClick={onRetry}>Try again</SecondaryButton> : null}
    </div>
  );
}

export const fieldLabel = "text-[13px] font-semibold";
export const fieldInput =
  "w-full rounded-2xl border-0 bg-white/85 px-3.5 py-3 text-[15px] text-ink outline-none ring-1 ring-transparent focus:ring-ink";
