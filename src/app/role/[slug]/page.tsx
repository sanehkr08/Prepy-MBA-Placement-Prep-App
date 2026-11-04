import { notFound } from "next/navigation";
import { resolveRole } from "@/lib/roles";
import { AppShell, PageTitle } from "@/components/ui";
import { RoleStarter } from "./RoleStarter";

/** Prepare for a role (listed or typed): builds the role kit once, then opens its fit map. */
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
      <PageTitle eyebrow="Prepare for a role">{role.name}</PageTitle>
      <p className="mt-3.5 max-w-[640px] text-[17px] text-muted">
        Prepy builds this role&apos;s concepts, frequently asked questions and practice questions, and maps them to your
        resume. The first time takes about a minute; after that it opens instantly.
      </p>
      <RoleStarter key={role.name} name={role.name} blurb={role.blurb} />
    </AppShell>
  );
}
