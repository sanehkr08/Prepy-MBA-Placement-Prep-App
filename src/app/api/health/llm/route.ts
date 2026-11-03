import { z } from "zod";
import { callLLM, errorResponse } from "@/lib/llm";

/** Quick check that the API key and model work: open /api/health/llm in the browser. */
export async function GET() {
  try {
    const out = await callLLM({
      name: "health",
      version: "v1",
      system: "You are a health check.",
      user: 'Return {"ok": true, "message": "Prepy can reach the model"}',
      schema: z.object({ ok: z.boolean(), message: z.string() }),
      maxTokens: 100,
    });
    return Response.json({ ...out, model: process.env.LLM_MODEL || "claude-sonnet-5-5" });
  } catch (err) {
    return errorResponse(err);
  }
}
