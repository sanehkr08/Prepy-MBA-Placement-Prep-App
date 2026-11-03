import { store } from "@/lib/store";

/** Delete every stored item: profile, JDs, kits, practice attempts, logs. */
export async function DELETE() {
  store.deleteAll();
  return Response.json({ ok: true });
}
