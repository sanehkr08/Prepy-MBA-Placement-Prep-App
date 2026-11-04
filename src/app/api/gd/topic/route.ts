import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { gdTopic } from "@/lib/gd";
import { cleanExclude } from "@/lib/topics";

/** A fresh group discussion topic (P19). Body: { exclude: topics already shown this session }. */
async function handlePOST(req: Request) {
  try {
    const { exclude } = (await req.json().catch(() => ({}))) as { exclude?: unknown };
    return Response.json({ topic: await gdTopic(cleanExclude(exclude)) });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = withUser(handlePOST);
