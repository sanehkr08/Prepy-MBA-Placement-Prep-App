import { withUser } from "@/lib/api-auth";
import { store } from "@/lib/store";
import { studyPlan } from "@/lib/prep";

async function handleGET(_req: Request, { params }: { params: Promise<{ jdId: string }> }) {
  const { jdId } = await params;
  return Response.json({ items: studyPlan(jdId), done: store.getPlanDone(jdId) });
}

async function handlePUT(req: Request, { params }: { params: Promise<{ jdId: string }> }) {
  const { jdId } = await params;
  const { done } = (await req.json()) as { done?: string[] };
  return Response.json({ done: store.setPlanDone(jdId, Array.isArray(done) ? done : []) });
}

export const GET = withUser(handleGET);
export const PUT = withUser(handlePUT);
