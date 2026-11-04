import { withUser } from "@/lib/api-auth";
import { store } from "@/lib/store";
import { ProfileSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/llm";
import { demoReadOnly } from "@/lib/demo";

async function handleGET() {
  return Response.json({ profile: await store.getProfile() });
}

/** Save the confirmed (reviewed) profile. */
async function handlePUT(req: Request, _ctx: unknown, userId: string) {
  try {
    const blocked = await demoReadOnly(userId);
    if (blocked) return blocked;
    const body = (await req.json()) as { profile: unknown; raw_text?: string };
    const parsed = ProfileSchema.safeParse(body.profile);
    if (!parsed.success) return Response.json({ error: "Profile is not valid." }, { status: 400 });
    const saved = await store.saveProfile(parsed.data, body.raw_text);
    return Response.json({ profile: saved });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = withUser(handleGET);
export const PUT = withUser(handlePUT);
