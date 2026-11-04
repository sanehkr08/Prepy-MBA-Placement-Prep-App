import { googleEnabled } from "@/auth";
import { DEMO_EMAIL, DEMO_PASSWORD, demoMode } from "@/lib/demo";
import { SignInForm } from "./SignInForm";

/** Sign in or create an account. Google appears once its keys are set in .env.local. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  // Only follow same-site paths after sign-in.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  // On the hosted demo, the shared demo login is shown so recruiters can get in with one click.
  const demo = demoMode() ? { email: DEMO_EMAIL, password: DEMO_PASSWORD } : null;
  return <SignInForm googleEnabled={googleEnabled} next={safeNext} authError={error ?? null} demo={demo} />;
}
