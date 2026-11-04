import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { finishGD } from "@/lib/gd";

/** Score the user's part in the discussion (P21) and save the feedback. */
async function handlePOST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json({ result: await finishGD(id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = withUser(handlePOST);
