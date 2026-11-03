import { withUser } from "@/lib/api-auth";
import { store } from "@/lib/store";
import { ProfileSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/llm";

async function handleGET() {
  return Response.json({ profile: store.getProfile() });
}

/** Save the confirmed (reviewed) profile. */
async function handlePUT(req: Request) {
  try {
    const body = (await req.json()) as { profile: unknown; raw_text?: string };
    const parsed = ProfileSchema.safeParse(body.profile);
    if (!parsed.success) return Response.json({ error: "Profile is not valid." }, { status: 400 });
    const saved = store.saveProfile(parsed.data, body.raw_text);
    return Response.json({ profile: saved });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = withUser(handleGET);
export const PUT = withUser(handlePUT);
