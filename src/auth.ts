/**
 * Sign-in with Auth.js: Google (when AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET are set)
 * and email + password. Sessions are signed JWT cookies (AUTH_SECRET); the token
 * carries our own user id from the users table.
 */
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { findUserByEmail, findUserById, upsertGoogleUser, verifyPassword } from "@/lib/users";

export const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: { email: {}, password: {} },
    authorize: async (creds) => {
      const email = String(creds?.email ?? "");
      const password = String(creds?.password ?? "");
      const user = findUserByEmail(email);
      if (!user || !verifyPassword(password, user.password_hash)) return null;
      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
];
if (googleEnabled) providers.push(Google);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  // Runs on localhost and behind `next start`; the host header is trusted.
  trustHost: true,
  callbacks: {
    jwt({ token, user, account }) {
      if (user) {
        // First request after sign-in: store our users-table id in the token.
        token.uid =
          account?.provider === "google" && user.email
            ? upsertGoogleUser({ email: user.email, name: user.name, image: user.image }).id
            : user.id;
      }
      // A valid cookie for an account that no longer exists (deleted, or from another
      // database on the same localhost) ends the session, so the user is sent to sign in.
      if (typeof token.uid !== "string" || !findUserById(token.uid)) return null;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});
