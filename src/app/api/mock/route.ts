import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { startMock } from "@/lib/mock";
import { store } from "@/lib/store";
import type { MockScore } from "@/lib/schemas";

/** Past (finished) mock interviews: for one JD or role kit with ?jdId=…, otherwise all of them. */
async function handleGET(req: Request) {
  const jdId = new URL(req.url).searchParams.get("jdId");
  const summary = (m: { id: string; created_at: string; data: { length: number; result: unknown } }) => {
    const r = m.data.result as MockScore | null;
    return {
      id: m.id,
      created_at: m.created_at,
      length: m.data.length,
      overall_score: r?.overall_score ?? null,
      verdict: r?.verdict ?? null,
    };
  };
  if (jdId) return Response.json({ mocks: (await store.listMocks(jdId)).map(summary) });
  return Response.json({
    mocks: (await store.listAllMocks()).map((m) => ({ ...summary(m), jd_id: m.jd_id, kit: m.kit })),
  });
}

/** Start a mock interview. Body: { jdId, length: 5 | 8 | 10, seconds: 120 | 180 | 240 }. */
async function handlePOST(req: Request) {
  try {
    const { jdId, length, seconds } = (await req.json().catch(() => ({}))) as { jdId?: string; length?: number; seconds?: number };
    const mock = await startMock(jdId ?? "", Number(length), Number(seconds));
    return Response.json({ id: mock.id });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = withUser(handleGET);
export const POST = withUser(handlePOST);
