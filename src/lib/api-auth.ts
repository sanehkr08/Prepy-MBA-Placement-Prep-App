/**
 * Wrap an API route so it only runs for a signed-in user, with the store and
 * caches scoped to that user (see user-context.ts).
 */
import { auth } from "@/auth";
import { findUserById } from "./users";
import { runAsUser } from "./user-context";

export async function sessionUserId(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id;
  // The account may have been removed while the cookie is still valid.
  return id && (await findUserById(id)) ? id : null;
}

export function withUser<C>(handler: (req: Request, ctx: C, userId: string) => Response | Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    const userId = await sessionUserId();
    if (!userId) return Response.json({ error: "Please sign in again." }, { status: 401 });
    return runAsUser(userId, () => handler(req, ctx, userId));
  };
}
