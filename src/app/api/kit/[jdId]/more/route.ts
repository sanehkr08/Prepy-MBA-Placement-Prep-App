import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { generateMore, MORE_TABS, type MoreTab } from "@/lib/prep";

/** Generate More: add new, non-repeating items to one kit tab. Body: { tab, topic? } (topic: concepts only). */
async function handlePOST(req: Request, { params }: { params: Promise<{ jdId: string }> }) {
  try {
    const { jdId } = await params;
    const { tab, topic } = (await req.json().catch(() => ({}))) as { tab?: string; topic?: string };
    if (!MORE_TABS.includes(tab as MoreTab)) {
      return Response.json({ error: "Unknown kit tab." }, { status: 400 });
    }
    return Response.json(await generateMore(jdId, tab as MoreTab, tab === "concepts" ? topic : undefined));
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = withUser(handlePOST);
