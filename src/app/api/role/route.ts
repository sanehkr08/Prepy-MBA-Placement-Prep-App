import { withUser } from "@/lib/api-auth";
import { callLLM, errorResponse } from "@/lib/llm";
import { JDSchema } from "@/lib/schemas";
import { P14 } from "@/lib/prompts";
import { store } from "@/lib/store";

/**
 * "Prepare for a role": returns the user's saved kit for this role, or builds one from a
 * standard role profile (P14) stored like a JD, so the fit map, kit and practice all work.
 * Body: { name }.
 */
async function handlePOST(req: Request) {
  try {
    if (!await store.getProfile()) return Response.json({ error: "Save your profile first." }, { status: 400 });
    const { name } = (await req.json().catch(() => ({}))) as { name?: string };
    const role = (name ?? "").replace(/\s+/g, " ").trim();
    if (role.length < 2 || role.length > 80) return Response.json({ error: "Enter a role name." }, { status: 400 });

    const saved = await store.findRoleJD(role);
    if (saved) return Response.json({ id: saved.id, created: false });

    const data = await callLLM({
      name: P14.name,
      version: P14.version,
      system: P14.system,
      user: P14.user(role),
      schema: JDSchema,
    });
    const rec = await store.createJD({ kind: "role", company: "", role, raw_text: "", data });
    return Response.json({ id: rec.id, created: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = withUser(handlePOST);
