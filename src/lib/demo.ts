/**
 * The hosted demo (DEMO_MODE=1): a shared demo account with a fictional sample profile,
 * sign-ups limited to the owner's emails, and daily caps on AI calls so the free
 * Gemini and Groq quotas can't be drained. Locally (DEMO_MODE unset) none of this applies.
 */
import { store } from "./store";
import { findUserByEmail, findUserById, createUserUnchecked } from "./users";
import { runAsUser } from "./user-context";
import type { Profile } from "./schemas";

export const demoMode = () => process.env.DEMO_MODE === "1";
export const DEMO_EMAIL = (process.env.DEMO_EMAIL || "demo@prepy.app").trim().toLowerCase();
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "prepy-demo";

const allowlist = () =>
  (process.env.ALLOWED_SIGNUP_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** New accounts on the demo are limited to the owner's emails; locally anyone may sign up. */
export function signupAllowed(email: string): boolean {
  return !demoMode() || allowlist().includes(email.trim().toLowerCase());
}

// A clearly fictional candidate, so recruiters can try every feature without a resume.
const SAMPLE_PROFILE: Profile = {
  name: "Aarav Mehta",
  headline: "MBA candidate · sample profile for the Prepy demo (fictional)",
  education: [
    { degree: "MBA (Marketing and Strategy)", institution: "Example Institute of Management (fictional)", years: "2025–2027" },
    { degree: "B.Tech, Mechanical Engineering", institution: "Sample Engineering College (fictional)", years: "2017–2021" },
  ],
  experience: [
    {
      title: "Business Analyst",
      company: "Northwind Retail (fictional)",
      dates: "2021–2024",
      bullets: [
        "Built a weekly sales dashboard in Excel and Power BI used by 14 regional managers",
        "Analysed store-level data to find slow-moving stock, cutting dead inventory by 18%",
        "Automated three manual reports with SQL, saving about 10 analyst hours a week",
        "Ran a pilot on shelf placement in 20 stores that lifted category sales by 6%",
      ],
    },
    {
      title: "Summer Intern, Product",
      company: "Contoso Fintech (fictional)",
      dates: "May–June 2026",
      bullets: [
        "Interviewed 25 small-business users to map pain points in invoice payments",
        "Wrote the PRD for a payment-reminder feature and prioritised it with the product lead",
      ],
    },
  ],
  projects: [
    { name: "Campus food-delivery study", description: "Surveyed 300 students and sized the market for late-night delivery on campus" },
  ],
  skills: ["Excel", "SQL", "Power BI", "Market research", "Stakeholder management"],
  achievements: ["Winner, inter-college case competition (fictional)", "Dean's list, first year of MBA (fictional)"],
  interests: ["Cricket", "Long-distance running", "Podcasts on business"],
};

/** Create the demo account (with its sample profile) the first time anyone uses it. */
export async function ensureDemoUser() {
  if (!demoMode()) return null;
  const existing = await findUserByEmail(DEMO_EMAIL);
  if (existing) return existing;
  const user = await createUserUnchecked({ email: DEMO_EMAIL, password: DEMO_PASSWORD, name: SAMPLE_PROFILE.name });
  await runAsUser(user.id, () => store.saveProfile(SAMPLE_PROFILE));
  return user;
}

// userId → email, so the per-call checks below don't hit the database every time.
const emailCache = new Map<string, string>();
async function emailOf(userId: string) {
  if (!emailCache.has(userId)) emailCache.set(userId, (await findUserById(userId))?.email ?? "");
  return emailCache.get(userId)!;
}

/** The shared demo account cannot change its profile or delete data. */
export async function isDemoUser(userId: string) {
  return demoMode() && (await emailOf(userId)) === DEMO_EMAIL;
}

/** A 403 response when the shared demo account tries to change or delete data; otherwise null. */
export async function demoReadOnly(userId: string): Promise<Response | null> {
  return (await isDemoUser(userId))
    ? Response.json({ error: "This isn't available in the shared demo account." }, { status: 403 })
    : null;
}

const PER_USER = () => Number(process.env.DAILY_AI_LIMIT_PER_USER) || 150;
const TOTAL = () => Number(process.env.DAILY_AI_LIMIT_TOTAL) || 600;

/**
 * Null when another AI call is fine; otherwise the message to show. Applies on the demo only.
 * The owner's accounts (ALLOWED_SIGNUP_EMAILS) are not capped per user, only by the site total.
 */
export async function dailyLimitMessage(userId: string | null): Promise<string | null> {
  if (!demoMode()) return null;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if ((await store.countLLMCalls(since)) >= TOTAL()) {
    return "The demo has reached today's AI limit. Please try again tomorrow.";
  }
  if (userId && !allowlist().includes(await emailOf(userId)) && (await store.countLLMCalls(since, userId)) >= PER_USER()) {
    return "You've reached today's AI limit for this demo account. Please try again tomorrow.";
  }
  return null;
}
