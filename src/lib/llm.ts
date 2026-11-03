/**
 * One wrapper for every LLM call. Asks for JSON only, validates it with Zod,
 * retries once with the validation error, and logs tokens and latency.
 * To switch provider, change only this file.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { store } from "./store";

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
    public readonly status = 500,
  ) {
    super(message);
  }
}

const DEFAULT_MODEL = "claude-sonnet-5-5";

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new LLMError(
      "ANTHROPIC_API_KEY missing",
      "No API key found. Add ANTHROPIC_API_KEY to .env.local and restart `npm run dev`.",
      503,
    );
  }
  client = client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function extractJSON(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function callLLM<S extends z.ZodTypeAny>(opts: {
  name: string;
  version: string;
  system: string;
  user: string;
  schema: S;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const anthropic = getClient();
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;
  const system =
    opts.system +
    "\n\nRespond with ONE valid JSON object only. No prose, no markdown fences.";

  let userContent = opts.user;
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const res = await anthropic.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 6000,
        system,
        messages: [{ role: "user", content: userContent }],
      });
      inputTokens = res.usage?.input_tokens ?? 0;
      outputTokens = res.usage?.output_tokens ?? 0;
      const text = res.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("");
      const parsed = opts.schema.safeParse(extractJSON(text));
      if (!parsed.success) throw new Error(parsed.error.message);
      store.logLLMCall({
        prompt_name: opts.name,
        prompt_version: opts.version,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        latency_ms: Date.now() - started,
        ok: true,
      });
      return parsed.data;
    } catch (err) {
      store.logLLMCall({
        prompt_name: opts.name,
        prompt_version: opts.version,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        latency_ms: Date.now() - started,
        ok: false,
      });
      if (err instanceof Anthropic.APIError) {
        const status = err.status ?? 500;
        const msg =
          status === 401
            ? "The API key was rejected. Check ANTHROPIC_API_KEY in .env.local."
            : status === 404
              ? `Model "${model}" was not found. Set LLM_MODEL in .env.local to a model your key can use.`
              : status === 429
                ? "Rate limit or credit limit reached. Wait a minute or check your API credits."
                : "The AI service returned an error. Try again.";
        throw new LLMError(err.message, msg, status);
      }
      lastError = err instanceof Error ? err.message : String(err);
      userContent =
        opts.user +
        `\n\nYour previous reply was not valid for the required JSON shape. Error: ${lastError.slice(0, 800)}\nReturn corrected JSON only.`;
    }
  }
  throw new LLMError(
    `Invalid JSON after retry: ${lastError}`,
    "The AI reply could not be read. Please try again.",
  );
}

/** Turn any thrown error into a JSON Response for API routes. */
export function errorResponse(err: unknown) {
  if (err instanceof LLMError) {
    return Response.json({ error: err.userMessage }, { status: err.status });
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Something went wrong.";
  return Response.json({ error: message }, { status: 500 });
}
