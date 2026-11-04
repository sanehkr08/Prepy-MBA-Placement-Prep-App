import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { requireGD } from "@/lib/gd";

/** One group discussion: turns so far and feedback once finished. */
async function handleGET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const g = requireGD(id);
    return Response.json({ gd: { id: g.id, created_at: g.created_at, ...g.data } });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = withUser(handleGET);
