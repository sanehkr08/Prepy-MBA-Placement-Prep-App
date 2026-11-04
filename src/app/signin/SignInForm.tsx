"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { api } from "@/lib/client";
import { ErrorBox, Logo, PrimaryButton, fieldInput, fieldLabel } from "@/components/ui";

type Mode = "signin" | "signup";

function GoogleMark() {
  // Google's "G" mark, as required on Google sign-in buttons.
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-16.6z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function SignInForm({
  googleEnabled,
  next,
  authError,
}: {
  googleEnabled: boolean;
  next: string;
  authError: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    authError ? "Sign-in did not complete. Please try again." : null,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await api("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
      }
      const res = await signIn("credentials", { email, password, redirect: false });
      if (!res || res.error) {
        setError("That email and password don't match. Check them, or create an account.");
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => {
        setMode(m);
        setError(null);
      }}
      className={`min-h-[44px] flex-1 rounded-full px-4 text-sm font-semibold transition ${
        mode === m ? "bg-ink text-white" : "text-ink hover:bg-white/60"
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-ground px-4 py-10">
      <div className="flex w-full max-w-[440px] flex-col gap-7">
        <Logo size={48} wordmark />
        <header>
          <h1 className="text-[44px] font-light leading-[1.02] tracking-[-0.02em]">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-3 text-[16px] text-muted">Interview prep built from your own story.</p>
        </header>

        <section className="flex flex-col gap-5 rounded-[32px] bg-panel p-6">
          {googleEnabled ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setBusy(true);
                  void signIn("google", { redirectTo: next });
                }}
                disabled={busy}
                className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-full bg-white px-5 text-[15px] font-semibold text-ink transition hover:bg-ground disabled:opacity-60"
              >
                <GoogleMark /> Continue with Google
              </button>
              <div className="flex items-center gap-3 text-[13px] text-muted" aria-hidden>
                <span className="h-px flex-1 bg-muted/30" /> or use email <span className="h-px flex-1 bg-muted/30" />
              </div>
            </>
          ) : null}

          <div role="tablist" aria-label="Sign in or create an account" className="flex gap-1 rounded-full bg-white/50 p-1">
            {tab("signin", "Sign in")}
            {tab("signup", "Create account")}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            {mode === "signup" ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="su-name" className={fieldLabel}>
                  Your name
                </label>
                <input
                  id="su-name"
                  className={fieldInput}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="si-email" className={fieldLabel}>
                Email
              </label>
              <input
                id="si-email"
                type="email"
                className={fieldInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="si-password" className={fieldLabel}>
                Password{mode === "signup" ? " (at least 8 characters)" : ""}
              </label>
              <input
                id="si-password"
                type="password"
                className={fieldInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={mode === "signup" ? 8 : undefined}
                required
              />
            </div>
            {error ? <ErrorBox message={error} /> : null}
            <PrimaryButton type="submit" disabled={busy} className="min-h-[52px]">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </PrimaryButton>
          </form>
        </section>
      </div>
    </main>
  );
}
