import { withUser } from "@/lib/api-auth";
import { runAsUser } from "@/lib/user-context";
import { after } from "next/server";
import { errorResponse } from "@/lib/llm";
import { ensureFit, prefetchKit, requireJD, requireProfile } from "@/lib/prep";
import { profileLines, refLabel } from "@/lib/profile-lines";

/** Fit and Gap Map for one JD (generated on first request, then cached). ?refresh=1 regenerates. */
async function handleGET(req: Request, { params }: { params: Promise<{ jdId: string }> }, userId: string) {
  try {
    const { jdId } = await params;
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    const jd = requireJD(jdId);
    const profile = requireProfile();
    const fit = await ensureFit(jdId, refresh);
    const lines = profileLines(profile.data);
    // Start building the prep kit while the user reads the fit map.
    after(() => runAsUser(userId, () => prefetchKit(jdId)));
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

export const GET = withUser(handleGET);
