import { withUser } from "@/lib/api-auth";
import { store } from "@/lib/store";

/** One saved impromptu speech with its feedback. */
async function handleGET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = store.getSpeech(id);
  if (!s) return Response.json({ error: "This speech was not found." }, { status: 404 });
  return Response.json({ speech: { id: s.id, created_at: s.created_at, ...s.data } });
}

export const GET = withUser(handleGET);
