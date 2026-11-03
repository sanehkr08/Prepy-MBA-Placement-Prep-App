import { errorResponse } from "@/lib/llm";
import { ensureFit, requireJD, requireProfile } from "@/lib/prep";
import { profileLines, refLabel } from "@/lib/profile-lines";

/** Fit and Gap Map for one JD (generated on first request, then cached). ?refresh=1 regenerates. */
export async function GET(req: Request, { params }: { params: Promise<{ jdId: string }> }) {
  try {
    const { jdId } = await params;
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    const jd = requireJD(jdId);
    const profile = requireProfile();
    const fit = await ensureFit(jdId, refresh);
    const lines = profileLines(profile.data);
    return Response.json({
      jd: { id: jd.id, company: jd.company, role: jd.role, role_family: jd.data.role_family },
      fit: {
        ...fit,
        items: fit.items.map((i) => ({ ...i, source_label: refLabel(lines, i.source_ref) })),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
