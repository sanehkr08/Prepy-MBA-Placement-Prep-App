import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { answerMock } from "@/lib/mock";

/**
 * Save an answer. Body: { index, stage: "main" | "followup", answer, inputMode }.
 * A main answer may return the interviewer's follow-up question.
 */
async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      index?: number;
      stage?: string;
      answer?: string;
      inputMode?: string;
    };
    const out = await answerMock(
      id,
      Number(body.index),
      body.stage === "followup" ? "followup" : "main",
      String(body.answer ?? ""),
      body.inputMode === "voice" ? "voice" : "typed",
    );
    return Response.json(out);
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = withUser(handlePOST);
