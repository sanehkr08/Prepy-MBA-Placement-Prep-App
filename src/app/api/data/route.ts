import { withUser } from "@/lib/api-auth";
import { store } from "@/lib/store";
import { demoReadOnly } from "@/lib/demo";

/** Delete every stored item: profile, JDs, kits, practice attempts, logs. */
async function handleDELETE(_req: Request, _ctx: unknown, userId: string) {
  const blocked = await demoReadOnly(userId);
  if (blocked) return blocked;
  await store.deleteAll();
  return Response.json({ ok: true });
}

export const DELETE = withUser(handleDELETE);
