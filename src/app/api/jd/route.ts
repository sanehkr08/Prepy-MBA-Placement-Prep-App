import { withUser } from "@/lib/api-auth";
import { callLLM, errorResponse } from "@/lib/llm";
import { textFromForm, ExtractError } from "@/lib/extract";
import { JDSchema } from "@/lib/schemas";
import { P2 } from "@/lib/prompts";
import { store } from "@/lib/store";

async function handleGET() {
  return Response.json({ jds: store.listJDs() });
}

/** Add a JD (pasted or PDF) → parsed and saved. */
async function handlePOST(req: Request) {
  try {
    if (!store.getProfile()) {
      return Response.json({ error: "Save your profile first." }, { status: 400 });
    }
    const form = await req.formData();
    const company = String(form.get("company") ?? "").trim();
    const role = String(form.get("role") ?? "").trim();
    if (!role) return Response.json({ error: "Enter the role name." }, { status: 400 });
    const text = await textFromForm(form);
    const data = await callLLM({
      name: P2.name,
      version: P2.version,
      system: P2.system,
      user: P2.user(text, company, role),
      schema: JDSchema,
    });
    const rec = store.createJD({ company, role: role || data.role, raw_text: text, data });
    return Response.json({ jd: { id: rec.id, company: rec.company, role: rec.role } });
  } catch (err) {
    if (err instanceof ExtractError) return Response.json({ error: err.message }, { status: 400 });
    return errorResponse(err);
  }
}

export const GET = withUser(handleGET);
export const POST = withUser(handlePOST);
