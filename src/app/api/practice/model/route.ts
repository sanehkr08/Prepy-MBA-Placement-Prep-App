import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { ensureModelAnswer, requireProfile } from "@/lib/prep";
import { profileLines, refLabel } from "@/lib/profile-lines";

/** Model answer for one practice item, written as the candidate would say it (P11). */
async function handlePOST(req: Request) {
  try {
    const { jdId, itemId } = (await req.json()) as { jdId?: string; itemId?: string };
    if (!jdId || !itemId) return Response.json({ error: "Missing question." }, { status: 400 });
    const model = await ensureModelAnswer(jdId, itemId);
    const lines = profileLines((await requireProfile()).data);
    return Response.json({
      model: { ...model, sources: model.source_refs.map((r) => refLabel(lines, r) ?? r) },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = withUser(handlePOST);
