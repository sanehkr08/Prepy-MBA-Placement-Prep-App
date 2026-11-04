"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Briefcase, Compass } from "lucide-react";
import { pickGreeting } from "@/lib/greetings";
import { ROLES } from "@/lib/roles";
import { useProfile } from "@/components/hooks";
import { AppShell, IconCircle, Logo } from "@/components/ui";
import { JDForm } from "@/components/JDForm";
import { JDHistory } from "@/components/JDHistory";

const LAST_GREETING = "prepy:last-greeting";
const GREETING_MAX_PX = 34;
const GREETING_MIN_PX = 20;

/**
 * Keep a heading on one line: start at the largest size and step down until it fits.
 * On screens too narrow even at the smallest size, let it wrap.
 */
function useOneLine(text: string | null) {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !text) return;
    const fit = () => {
      el.style.whiteSpace = "nowrap";
      let size = GREETING_MAX_PX;
      el.style.fontSize = `${size}px`;
      while (el.scrollWidth > el.clientWidth && size > GREETING_MIN_PX) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
      if (el.scrollWidth > el.clientWidth) el.style.whiteSpace = "normal";
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [text]);
  return ref;
}

/** Home: a greeting, then the two ways to prepare (a common role, or your own JD). */
export default function HomePage() {
  const router = useRouter();
  const { profile, loaded } = useProfile();
  const [greeting, setGreeting] = useState<string | null>(null);
  const [customRole, setCustomRole] = useState("");
  const greetingRef = useOneLine(greeting);

  // New accounts set up their profile first.
  useEffect(() => {
    if (loaded && !profile) router.replace("/onboarding");
  }, [loaded, profile, router]);

  // A fresh greeting on every visit, never the same line twice in a row.
  // Picked after mount: the time of day and the random pick belong to the browser.
  useEffect(() => {
    if (!profile) return;
    let last: string | undefined;
    try {
      last = sessionStorage.getItem(LAST_GREETING) ?? undefined;
    } catch {
      /* storage unavailable */
    }
    const g = pickGreeting(profile.data.name.split(" ")[0], new Date(), last);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(g);
    try {
      sessionStorage.setItem(LAST_GREETING, g);
    } catch {
      /* storage unavailable */
    }
  }, [profile]);

  return (
    <AppShell active="home" nav="home">
      <div className="flex justify-center">
        <Logo size={44} wordmark />
      </div>

      <header className="mt-10 text-center">
        <h1
          ref={greetingRef}
          aria-live="polite"
          style={{ fontSize: GREETING_MAX_PX }}
          className={`min-h-[1.3em] overflow-hidden font-light leading-[1.25] tracking-[-0.015em] transition-opacity duration-500 ${
            greeting ? "opacity-100" : "opacity-0"
          }`}
        >
          {greeting ?? "Hello"}
        </h1>
        <p className="mt-2.5 text-[17px] text-muted">What are we preparing for today?</p>
      </header>

      <div className="mt-9 grid items-start gap-5 lg:grid-cols-2">
        {/* Path 1: a common role, no JD needed */}
        <section aria-labelledby="role-h" className="flex flex-col gap-4 rounded-[32px] bg-lavender p-6 md:p-7">
          <div className="flex items-center gap-2.5">
            <IconCircle>
              <Compass size={18} strokeWidth={1.7} aria-hidden />
            </IconCircle>
            <span className="text-[13px] font-medium">No JD yet? Start here</span>
          </div>
          <h2 id="role-h" className="text-[28px] font-medium leading-tight tracking-[-0.01em]">
            Prepare for a role
          </h2>
          <p className="text-[15px]">
            Pick a role. Prepy builds its concepts, practice questions and mock interviews, mapped to your resume.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = customRole.trim();
              if (name) router.push(`/role/custom?name=${encodeURIComponent(name)}`);
            }}
            className="flex flex-col gap-1.5"
          >
            <label htmlFor="custom-role" className="text-[13px] font-semibold">
              Type the role you want to prepare for
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="custom-role"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="e.g. Category Manager, Strategy Analyst, Product Marketing Manager"
                maxLength={80}
                className="min-h-[48px] min-w-0 flex-[1_1_240px] rounded-2xl bg-white px-4 text-[15px] text-ink outline-none ring-1 ring-transparent focus:ring-ink"
              />
              <button
                type="submit"
                disabled={!customRole.trim()}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prepare <ArrowRight size={16} aria-hidden />
              </button>
            </div>
          </form>
          <p className="text-[13px] font-semibold">Or pick a popular role</p>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {ROLES.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/role/${r.slug}`}
                  className="flex min-h-[64px] flex-col justify-center rounded-[20px] bg-white px-4 py-2.5 no-underline transition hover:bg-ground"
                >
                  <span className="text-[15px] font-semibold">{r.name}</span>
                  <span className="text-[12px] text-muted">{r.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Path 2: the user's own JD */}
        <section aria-labelledby="jd-h" className="flex flex-col gap-4 rounded-[32px] bg-peach p-6 md:p-7">
          <div className="flex items-center gap-2.5">
            <IconCircle>
              <Briefcase size={18} strokeWidth={1.7} aria-hidden />
            </IconCircle>
            <span className="text-[13px] font-medium">Got a JD? Go deeper</span>
          </div>
          <JDForm
            idPrefix="home-jd"
            rows={5}
            disabled={!profile}
            heading={
              <h2 id="jd-h" className="text-[28px] font-medium leading-tight tracking-[-0.01em]">
                Prepare for your JD
              </h2>
            }
            intro={
              <p className="text-[15px]">
                Upload or paste a job description. See how you fit, get a prep kit for that exact role, and practise with
                scored feedback.
              </p>
            }
          />
          <JDHistory hrefFor={(id) => `/kit/${id}`} limit={4} title="Pick up where you left off" />
        </section>
      </div>
    </AppShell>
  );
}
