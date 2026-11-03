import { withUser } from "@/lib/api-auth";
import { findUserById } from "@/lib/users";

/** The signed-in account: name, email and picture (for greetings and the avatar). */
async function handleGET(_req: Request, _ctx: unknown, userId: string) {
  const u = findUserById(userId)!;
  return Response.json({ user: { name: u.name, email: u.email, image: u.image } });
}

export const GET = withUser(handleGET);
