import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { ensureOutline, requireProfile } from "@/lib/prep";
import { profileLines, refLabel } from "@/lib/profile-lines";

/** STAR answer outline for one question, grounded in the profile. */
async function handlePOST(req: Request, { params }: { params: Promise<{ jdId: string }> }) {
  try {
    const { jdId } = await params;
    const { question } = (await req.json()) as { question?: string };
    if (!question) return Response.json({ error: "Missing question." }, { status: 400 });
    const outline = await ensureOutline(jdId, question);
    const lines = profileLines((await requireProfile()).data);
    return Response.json({
      outline: {
        ...outline,
        sources: outline.source_refs.map((r) => ({
          ref: r,
          label: refLabel(lines, r),
          text: lines.find((l) => l.ref === r)?.text ?? "",
        })),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = withUser(handlePOST);
