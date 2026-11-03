import { withUser } from "@/lib/api-auth";
import { callLLM, errorResponse } from "@/lib/llm";
import { textFromForm, ExtractError } from "@/lib/extract";
import { ProfileSchema } from "@/lib/schemas";
import { P1 } from "@/lib/prompts";

/** Upload or paste a resume → parsed profile (not saved until the user confirms). */
async function handlePOST(req: Request) {
  try {
    const form = await req.formData();
    const text = await textFromForm(form);
    const profile = await callLLM({
      name: P1.name,
      version: P1.version,
      system: P1.system,
      user: P1.user(text),
      schema: ProfileSchema,
    });
    return Response.json({ profile, raw_text: text });
  } catch (err) {
    if (err instanceof ExtractError) return Response.json({ error: err.message }, { status: 400 });
    return errorResponse(err);
  }
}

export const POST = withUser(handlePOST);
