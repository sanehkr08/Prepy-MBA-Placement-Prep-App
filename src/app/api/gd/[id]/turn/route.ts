import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { takeTurn } from "@/lib/gd";

/**
 * The user's move: { action: "start" | "speak" | "pass" | "summary", text }.
 * In full mode, the AI members' next round (P20) comes back with it.
 */
async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const b = (await req.json().catch(() => ({}))) as { action?: string; text?: string };
    const { gd, next } = await takeTurn(id, String(b.action ?? ""), String(b.text ?? ""));
    return Response.json({ gd: { id: gd.id, created_at: gd.created_at, ...gd.data }, next });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = withUser(handlePOST);
