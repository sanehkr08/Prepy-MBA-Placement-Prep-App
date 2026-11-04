/**
 * One wrapper for every LLM call. Asks for JSON only, validates it with Zod,
 * retries once with the validation error, and logs tokens and latency.
 *
 * Providers (pick with LLM_PROVIDER in .env.local, or it is chosen from the key you set):
 *   gemini     GEMINI_API_KEY      free tier via Google AI Studio (default model: gemini-flash-lite-latest;
 *                                  the bigger gemini-flash-latest allows only ~20 free requests a day)
 *   groq       GROQ_API_KEY        Groq (not Grok), free tier, open models (default model: openai/gpt-oss-120b)
 *   xai        XAI_API_KEY         Grok, paid / promotional credits (default model: grok-4.3)
 *   anthropic  ANTHROPIC_API_KEY   Claude, paid (default model: claude-sonnet-5-5)
 * LLM_MODEL overrides the model for the chosen provider; GEMINI_MODEL / GROQ_MODEL /
 * XAI_MODEL / ANTHROPIC_MODEL override per provider.
 *
 * Fallback: when more than one key is set, the chosen provider goes first and the others
 * (in the order above) take over if it fails, e.g. when Gemini's free tier hits its rate limit.
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

type Provider = "gemini" | "groq" | "xai" | "anthropic";

const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: "gemini-flash-lite-latest",
  groq: "openai/gpt-oss-120b",
  xai: "grok-4.3",
  anthropic: "claude-sonnet-5-5",
};

// Order matters: free providers first, so they lead the fallback chain.
const KEY_VARS: Record<Provider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  xai: "XAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

export function activeProvider(): Provider {
  const p = (process.env.LLM_PROVIDER || "").toLowerCase().trim() as Provider;
  if (p in KEY_VARS) return p;
  return (Object.keys(KEY_VARS) as Provider[]).find((k) => process.env[KEY_VARS[k]]) ?? "gemini";
}

/** The chosen provider first, then every other provider that has a key set. */
export function providerChain(): Provider[] {
  const primary = activeProvider();
  const others = (Object.keys(KEY_VARS) as Provider[]).filter(
    (p) => p !== primary && process.env[KEY_VARS[p]],
  );
  return [primary, ...others];
}

export function activeModel(provider = activeProvider()) {
  const own = process.env[`${KEY_VARS[provider].replace("_API_KEY", "")}_MODEL`];
  if (own) return own;
  // LLM_MODEL belongs to the main provider; fallbacks keep their defaults.
  if (provider === activeProvider() && process.env.LLM_MODEL) return process.env.LLM_MODEL;
  return DEFAULT_MODELS[provider];
}

let lastUsed: Provider | null = null;
/** The provider that answered the most recent successful call. */
export function lastProvider(): Provider {
  return lastUsed ?? activeProvider();
}

function requireKey(provider: Provider) {
  const key = process.env[KEY_VARS[provider]];
  if (!key) {
    throw new LLMError(
      `${KEY_VARS[provider]} missing`,
      `No API key found. Add ${KEY_VARS[provider]}=your-key to .env.local and restart \`npm run dev\`.`,
      503,
    );
  }
  return key;
}

type RawResult = { text: string; inputTokens: number; outputTokens: number };

class HTTPError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterSec = 0,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A call that hangs is cut off and handed to the next provider; the last provider gets longer.
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 45_000;
const LAST_TIMEOUT_MS = 120_000;

// Providers whose daily quota ran out are skipped until Google/Groq say to retry,
// instead of paying a failed round trip on every call.
const coolingUntil: Partial<Record<Provider, number>> = {};

/** Output length and randomness for one call (temperature: 0.4 by default; higher for creative work like topics). */
type Gen = { maxTokens: number; temperature: number };
type CallFn = (system: string, user: string, gen: Gen, signal: AbortSignal) => Promise<RawResult>;

/* ---------------- provider calls ---------------- */

async function callGemini(system: string, user: string, gen: Gen, signal: AbortSignal): Promise<RawResult> {
  const key = requireKey("gemini");
  const model = activeModel("gemini");
  const base = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";
  const res = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: gen.temperature,
        // Flash models may "think" before answering; leave room for that plus the JSON.
        maxOutputTokens: Math.max(gen.maxTokens * 2, 8192),
        // Gemini 3 models: keep thinking short, it is most of the wait. (2.x models reject this field.)
        ...(/gemini-2\./.test(model) ? {} : { thinkingConfig: { thinkingLevel: "low" } }),
      },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    error?: { message?: string; details?: { retryDelay?: string }[] };
  };
  if (!res.ok) {
    const retry = body.error?.details?.find((d) => d.retryDelay)?.retryDelay;
    throw new HTTPError(res.status, body.error?.message || `Gemini error ${res.status}`, retry ? parseInt(retry) : 0);
  }
  const cand = body.candidates?.[0];
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
  if (!text) throw new Error(`Empty reply from Gemini (finishReason: ${cand?.finishReason ?? "unknown"})`);
  return {
    text,
    inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

const OPENAI_COMPAT = {
  groq: { label: "Groq", base: () => process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1" },
  xai: { label: "xAI", base: () => process.env.XAI_BASE_URL || "https://api.x.ai/v1" },
};

/** Groq and xAI both speak the OpenAI chat-completions format. */
async function callOpenAICompat(
  provider: keyof typeof OPENAI_COMPAT,
  system: string,
  user: string,
  gen: Gen,
  signal: AbortSignal,
): Promise<RawResult> {
  const key = requireKey(provider);
  const { label, base } = OPENAI_COMPAT[provider];
  const res = await fetch(`${base()}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: activeModel(provider),
      // Groq's default gpt-oss model reasons before answering: leave room for that, keep it short.
      ...(activeModel(provider).startsWith("openai/gpt-oss")
        ? { max_tokens: Math.max(gen.maxTokens, 2048), reasoning_effort: "low" }
        : { max_tokens: gen.maxTokens }),
      temperature: gen.temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string } | string;
  };
  if (!res.ok) {
    const msg = typeof body.error === "string" ? body.error : body.error?.message;
    throw new HTTPError(res.status, msg || `${label} error ${res.status}`, Number(res.headers.get("retry-after")) || 0);
  }
  return {
    text: body.choices?.[0]?.message?.content ?? "",
    inputTokens: body.usage?.prompt_tokens ?? 0,
    outputTokens: body.usage?.completion_tokens ?? 0,
  };
}

let anthropic: Anthropic | null = null;
async function callAnthropic(system: string, user: string, gen: Gen, signal: AbortSignal): Promise<RawResult> {
  const key = requireKey("anthropic");
  anthropic = anthropic ?? new Anthropic({ apiKey: key });
  try {
    const res = await anthropic.messages.create(
      {
        model: activeModel("anthropic"),
        // No temperature: current Claude models don't take sampling settings.
        max_tokens: gen.maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      },
      { signal },
    );
    return {
      text: res.content.map((b) => (b.type === "text" ? b.text : "")).join(""),
      inputTokens: res.usage?.input_tokens ?? 0,
      outputTokens: res.usage?.output_tokens ?? 0,
    };
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new HTTPError(err.status ?? 500, err.message);
    throw err;
  }
}

const PROVIDER_FNS: Record<Provider, CallFn> = {
  gemini: callGemini,
  groq: (s, u, g, sig) => callOpenAICompat("groq", s, u, g, sig),
  xai: (s, u, g, sig) => callOpenAICompat("xai", s, u, g, sig),
  anthropic: callAnthropic,
};

const isTimeout = (err: unknown) => err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");

async function callOne(provider: Provider, system: string, user: string, gen: Gen, canFallBack: boolean) {
  const fn = PROVIDER_FNS[provider];
  const timeout = canFallBack ? TIMEOUT_MS : LAST_TIMEOUT_MS;
  try {
    return await fn(system, user, gen, AbortSignal.timeout(timeout));
  } catch (err) {
    if (err instanceof HTTPError && err.status === 429) {
      // A long retry delay means the daily quota is gone: stop asking this provider for now.
      if (err.retryAfterSec > 60) coolingUntil[provider] = Date.now() + err.retryAfterSec * 1000;
      // Free tiers allow only a few requests per minute: wait once and retry,
      // unless another provider can take over straight away.
      else if (!canFallBack) {
        await sleep(Math.max(err.retryAfterSec, 10) * 1000);
        return fn(system, user, gen, AbortSignal.timeout(timeout));
      }
    }
    throw err;
  }
}

async function callProvider(system: string, user: string, gen: Gen): Promise<RawResult> {
  const all = providerChain();
  const ready = all.filter((p) => (coolingUntil[p] ?? 0) < Date.now());
  const chain = ready.length ? ready : all;
  for (let i = 0; ; i++) {
    const provider = chain[i];
    const canFallBack = i < chain.length - 1;
    try {
      const raw = await callOne(provider, system, user, gen, canFallBack);
      lastUsed = provider;
      return raw;
    } catch (err) {
      if (!canFallBack) {
        if (err instanceof HTTPError) throw friendlyHTTPError(err, provider);
        if (isTimeout(err)) throw new LLMError(`${provider} timed out`, "The AI took too long to answer. Please try again.", 504);
        throw err;
      }
      const reason = isTimeout(err) ? "timed out" : err instanceof Error ? err.message : String(err);
      console.warn(`[llm] ${provider} failed (${reason.slice(0, 200)}); falling back to ${chain[i + 1]}`);
    }
  }
}

function friendlyHTTPError(err: HTTPError, provider: Provider): LLMError {
  const keyVar = KEY_VARS[provider];
  const model = activeModel(provider);
  const msg =
    err.status === 400 && /api key/i.test(err.message)
      ? `The API key was rejected. Check ${keyVar} in .env.local.`
      : err.status === 401 || err.status === 403
        ? `The API key was rejected. Check ${keyVar} in .env.local.`
        : err.status === 404
          ? `Model "${model}" was not found for ${provider}. Set ${keyVar.replace("_API_KEY", "")}_MODEL in .env.local to a model your key can use.`
          : err.status === 429
            ? err.retryAfterSec > 60
              ? `The free daily limit for ${provider} is used up. Add another provider's key in .env.local, or try again tomorrow.`
              : "Free-tier rate limit reached. Wait a minute and try again."
            : `The AI service returned an error (${err.status}). Try again.`;
  return new LLMError(err.message, msg, err.status);
}

/* ---------------- public API ---------------- */

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
  /** 0.4 by default; raise it (up to about 1) when variety matters more than consistency. */
  temperature?: number;
}): Promise<z.infer<S>> {
  const system =
    opts.system + "\n\nRespond with ONE valid JSON object only. No prose, no markdown fences.";
  let userContent = opts.user;
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const raw = await callProvider(system, userContent, { maxTokens: opts.maxTokens ?? 6000, temperature: opts.temperature ?? 0.4 });
      inputTokens = raw.inputTokens;
      outputTokens = raw.outputTokens;
      const parsed = opts.schema.safeParse(extractJSON(raw.text));
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
      if (err instanceof LLMError) throw err;
      lastError = err instanceof Error ? err.message : String(err);
      userContent =
        opts.user +
        `\n\nYour previous reply was not valid for the required JSON shape. Error: ${lastError.slice(0, 800)}\nReturn corrected JSON only.`;
    }
  }
  throw new LLMError(`Invalid JSON after retry: ${lastError}`, "The AI reply could not be read. Please try again.");
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
