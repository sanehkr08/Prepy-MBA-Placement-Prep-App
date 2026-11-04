import { withUser } from "@/lib/api-auth";
import { store } from "@/lib/store";
import { demoReadOnly } from "@/lib/demo";

/** Delete one of the user's JDs, with its fit map, prep kit, study plan and practice answers. */
async function handleDELETE(_req: Request, { params }: { params: Promise<{ id: string }> }, userId: string) {
  const blocked = await demoReadOnly(userId);
  if (blocked) return blocked;
  const { id } = await params;
  if (!(await store.deleteJD(id))) return Response.json({ error: "This job description was not found." }, { status: 404 });
  return Response.json({ ok: true });
}

export const DELETE = withUser(handleDELETE);
