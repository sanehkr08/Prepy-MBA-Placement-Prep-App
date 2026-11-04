import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { newTopic } from "@/lib/impromptu";
import { cleanExclude } from "@/lib/topics";

/** A fresh impromptu topic. Body: { categories: ("business" | "personal" | "role")[], exclude: topics shown this session }. */
async function handlePOST(req: Request) {
  try {
    const { categories, exclude } = (await req.json().catch(() => ({}))) as { categories?: string[]; exclude?: unknown };
    return Response.json({ topic: await newTopic(Array.isArray(categories) ? categories : [], cleanExclude(exclude)) });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = withUser(handlePOST);
