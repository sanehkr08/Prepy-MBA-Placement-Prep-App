import { errorResponse } from "@/lib/llm";
import { ensureConceptNotes } from "@/lib/prep";

/** Study notes for one concept ("Read more"). Body: { topic, item } (positions in the concepts list). */
export async function POST(req: Request, { params }: { params: Promise<{ jdId: string }> }) {
  try {
    const { jdId } = await params;
    const { topic, item } = (await req.json().catch(() => ({}))) as { topic?: number; item?: number };
    if (!Number.isInteger(topic) || !Number.isInteger(item)) {
      return Response.json({ error: "Missing concept." }, { status: 400 });
    }
    return Response.json({ notes: await ensureConceptNotes(jdId, topic!, item!) });
  } catch (err) {
    return errorResponse(err);
  }
}
