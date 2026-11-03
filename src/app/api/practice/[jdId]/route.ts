import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { ensureConceptQuestions, ensureSection, practiceItems, requireJD } from "@/lib/prep";
import { KIT_SECTIONS } from "@/lib/schemas";
import { store } from "@/lib/store";

/** Practice queue for a JD. Generates any missing kit sections first. */
async function handleGET(_req: Request, { params }: { params: Promise<{ jdId: string }> }) {
  try {
    const { jdId } = await params;
    const jd = requireJD(jdId);
    for (const s of KIT_SECTIONS) await ensureSection(jdId, s);
    // Interview-style questions for each concept. If this fails, practice still works with a plain fallback.
    await ensureConceptQuestions(jdId).catch((err) => console.warn(`[practice] concept questions: ${err}`));
    const attempts = store.listAttempts(jdId);
    const attempted = Array.from(new Set(attempts.map((a) => a.item_id)));
    return Response.json({
      jd: { id: jd.id, company: jd.company, role: jd.role },
      items: practiceItems(jdId),
      attempted,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = withUser(handleGET);
