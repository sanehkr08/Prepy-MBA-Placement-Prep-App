import { withUser } from "@/lib/api-auth";
import { errorResponse } from "@/lib/llm";
import { ensureSection, requireJD } from "@/lib/prep";
import { KIT_SECTIONS, type KitSection } from "@/lib/schemas";

/** One prep-kit section: concepts | questions | cases | situational. ?refresh=1 regenerates. */
async function handleGET(
  req: Request,
  { params }: { params: Promise<{ jdId: string; section: string }> },
) {
  try {
    const { jdId, section } = await params;
    if (!KIT_SECTIONS.includes(section as KitSection)) {
      return Response.json({ error: "Unknown section." }, { status: 404 });
    }
    const jd = requireJD(jdId);
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    const data = await ensureSection(jdId, section as KitSection, refresh);
    return Response.json({
      jd: { id: jd.id, company: jd.company, role: jd.role, role_family: jd.data.role_family },
      data,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = withUser(handleGET);
