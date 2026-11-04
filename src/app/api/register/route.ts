import { createPasswordUser, SignUpError } from "@/lib/users";

/** Email/password sign-up. The client signs in right after with the same details. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; email?: string; password?: string };
  try {
    await createPasswordUser({ name: body.name ?? "", email: body.email ?? "", password: body.password ?? "" });
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof SignUpError) return Response.json({ error: err.message }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Could not create the account. Try again." }, { status: 500 });
  }
}
