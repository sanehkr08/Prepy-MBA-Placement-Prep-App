/**
 * Every page and API route needs a signed-in user, except the sign-in page and
 * the sign-in endpoints. Pages redirect to /signin; API routes answer 401.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC = ["/signin", "/api/auth", "/api/register"];

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const signedIn = !!req.auth?.user;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!signedIn && !isPublic) {
    if (pathname.startsWith("/api/")) return Response.json({ error: "Please sign in." }, { status: 401 });
    const url = new URL("/signin", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (signedIn && pathname === "/signin") return NextResponse.redirect(new URL("/", req.url));
});

export const config = {
  // Skip Next's own files and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)"],
};
