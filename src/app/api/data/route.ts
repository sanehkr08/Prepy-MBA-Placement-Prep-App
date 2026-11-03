import { withUser } from "@/lib/api-auth";
import { store } from "@/lib/store";

/** Delete every stored item: profile, JDs, kits, practice attempts, logs. */
async function handleDELETE() {
  store.deleteAll();
  return Response.json({ ok: true });
}

export const DELETE = withUser(handleDELETE);
