import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { requireMock } from "@/lib/mock";
import { requireJD } from "@/lib/prep";

/** One mock interview: questions, answers so far, and the scorecard once finished. */
async function handleGET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const m = await requireMock(id);
    const jd = await requireJD(m.jd_id);
    return Response.json({
      mock: {
        id: m.id,
        created_at: m.created_at,
        finished: !!m.finished_at,
        jd: { id: jd.id, kind: jd.kind, company: jd.company, role: jd.role },
        ...m.data,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = withUser(handleGET);
