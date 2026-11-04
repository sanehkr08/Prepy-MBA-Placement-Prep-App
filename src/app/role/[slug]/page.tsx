import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveRole } from "@/lib/roles";
import { AppShell, PageTitle, primaryLink } from "@/components/ui";

/** Prepare for a role: the role kit is built in v1 step 3; until then this page says so. */
export default async function RolePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  const [{ slug }, { name }] = await Promise.all([params, searchParams]);
  const role = resolveRole(slug, name);
  if (!role) notFound();
  return (
    <AppShell active="home">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-full bg-peach px-2.5 py-1 text-xs font-bold">Coming next</span>
      </div>
      <PageTitle eyebrow="Prepare for a role">{role.name}</PageTitle>
      <p className="mt-3.5 max-w-[640px] text-[17px] text-muted">
        Concepts, frequently asked questions, practice questions mapped to your resume, and mock interviews for this role
        are being built next. Until then, add a JD for a {role.name} role to get a full prep kit.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/jd" className={primaryLink}>
          Add a JD instead
        </Link>
        <Link href="/" className="inline-flex min-h-[48px] items-center rounded-full bg-white px-5 text-sm font-semibold no-underline hover:bg-panel">
          Back to home
        </Link>
      </div>
    </AppShell>
  );
}
