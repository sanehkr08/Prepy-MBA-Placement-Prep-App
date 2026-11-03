import { store } from "@/lib/store";
import { ProfileSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/llm";

export async function GET() {
  return Response.json({ profile: store.getProfile() });
}

/** Save the confirmed (reviewed) profile. */
export async function PUT(req: Request) {
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
