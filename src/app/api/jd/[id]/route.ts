import { withUser } from "@/lib/api-auth";
import { store } from "@/lib/store";

/** Delete one of the user's JDs, with its fit map, prep kit, study plan and practice answers. */
async function handleDELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!store.deleteJD(id)) return Response.json({ error: "This job description was not found." }, { status: 404 });
  return Response.json({ ok: true });
}

export const DELETE = withUser(handleDELETE);
