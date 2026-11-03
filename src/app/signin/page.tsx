import { googleEnabled } from "@/auth";
import { SignInForm } from "./SignInForm";

/** Sign in or create an account. Google appears once its keys are set in .env.local. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  // Only follow same-site paths after sign-in.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return <SignInForm googleEnabled={googleEnabled} next={safeNext} authError={error ?? null} />;
}
