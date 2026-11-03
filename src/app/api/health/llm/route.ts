import { withUser } from "@/lib/api-auth";
import { z } from "zod";
import { callLLM, errorResponse, lastProvider, activeModel, providerChain } from "@/lib/llm";

/** Quick check that the API key and model work: open /api/health/llm in the browser. */
async function handleGET() {
  try {
    const out = await callLLM({
      name: "health",
      version: "v1",
      system: "You are a health check.",
      user: 'Return {"ok": true, "message": "Prepy can reach the model"}',
      schema: z.object({ ok: z.boolean(), message: z.string() }),
      maxTokens: 100,
    });
    const provider = lastProvider();
    return Response.json({ ...out, provider, model: activeModel(provider), chain: providerChain() });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = withUser(handleGET);
