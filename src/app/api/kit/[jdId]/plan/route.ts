import { store } from "@/lib/store";
import { studyPlan } from "@/lib/prep";

export async function GET(_req: Request, { params }: { params: Promise<{ jdId: string }> }) {
  const { jdId } = await params;
  return Response.json({ items: studyPlan(jdId), done: store.getPlanDone(jdId) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ jdId: string }> }) {
  const { jdId } = await params;
  const { done } = (await req.json()) as { done?: string[] };
  return Response.json({ done: store.setPlanDone(jdId, Array.isArray(done) ? done : []) });
}
