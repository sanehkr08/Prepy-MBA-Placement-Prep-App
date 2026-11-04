import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { finishMock } from "@/lib/mock";

/** Score the whole interview (P16) and save the scorecard. */
async function handlePOST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json({ result: await finishMock(id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = withUser(handlePOST);
