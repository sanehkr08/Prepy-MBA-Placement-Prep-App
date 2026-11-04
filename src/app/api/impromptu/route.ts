import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { scoreSpeech } from "@/lib/impromptu";
import { store } from "@/lib/store";
import type { ImpromptuScore } from "@/lib/schemas";

/** Past impromptu speeches, newest first. */
async function handleGET() {
  const speeches = (await store.listSpeeches()).map((s) => ({
    id: s.id,
    created_at: s.created_at,
    topic: s.data.topic,
    overall_score: (s.data.result as ImpromptuScore).overall_score,
  }));
  return Response.json({ speeches });
}

/** Score a speech and save it. Body: topic, category, prep_seconds, speak_seconds, duration_seconds, transcript, input_mode. */
async function handlePOST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const rec = await scoreSpeech({
      topic: String(b.topic ?? ""),
      category: String(b.category ?? ""),
      prep_seconds: Number(b.prep_seconds) || 0,
      speak_seconds: Number(b.speak_seconds) || 120,
      duration_seconds: Number(b.duration_seconds) || 0,
      transcript: String(b.transcript ?? ""),
      input_mode: b.input_mode === "typed" ? "typed" : "voice",
    });
    return Response.json({ speech: { id: rec.id, created_at: rec.created_at, ...rec.data } });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = withUser(handleGET);
export const POST = withUser(handlePOST);
