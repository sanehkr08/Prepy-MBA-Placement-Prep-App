import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { newTopic } from "@/lib/impromptu";

/** A fresh impromptu topic. Body: { categories: ("business" | "personal" | "role")[] }. */
async function handlePOST(req: Request) {
  try {
    const { categories } = (await req.json().catch(() => ({}))) as { categories?: string[] };
    return Response.json({ topic: await newTopic(Array.isArray(categories) ? categories : []) });
  } catch (err) {
    return errorResponse(err);
  }
}

export const POST = withUser(handlePOST);
