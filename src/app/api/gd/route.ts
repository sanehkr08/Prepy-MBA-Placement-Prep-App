import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { startGD } from "@/lib/gd";
import { store } from "@/lib/store";
import type { GDScore } from "@/lib/schemas";

/** Past (finished) group discussions, newest first. */
async function handleGET() {
  const gds = (await store.listGDs()).map((g) => ({
    id: g.id,
    created_at: g.created_at,
    mode: g.data.mode,
    topic: g.data.topic,
    overall_score: (g.data.result as GDScore | null)?.overall_score ?? null,
  }));
  return Response.json({ gds });
}

/** Start a group discussion. Body: { participants: 0 | 2 | 3, topic, context, input_mode }. 0 = just the user. */
async function handlePOST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const g = await startGD({
      participants: Number(b.participants ?? 3),
      topic: String(b.topic ?? ""),
      context: String(b.context ?? ""),
      input_mode: String(b.input_mode ?? "voice"),
    });
    return Response.json({ gd: { id: g.id, created_at: g.created_at, ...g.data } });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = withUser(handleGET);
export const POST = withUser(handlePOST);
