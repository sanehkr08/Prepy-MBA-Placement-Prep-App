import { errorResponse } from "@/lib/llm";
import { ensureSection, practiceItems, requireJD } from "@/lib/prep";
import { KIT_SECTIONS } from "@/lib/schemas";
import { store } from "@/lib/store";

/** Practice queue for a JD. Generates any missing kit sections first. */
export async function GET(_req: Request, { params }: { params: Promise<{ jdId: string }> }) {
  try {
    const { jdId } = await params;
    const jd = requireJD(jdId);
    for (const s of KIT_SECTIONS) await ensureSection(jdId, s);
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
