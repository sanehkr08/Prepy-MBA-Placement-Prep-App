/**
 * Sign-in with Auth.js: Google (when AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET are set)
 * and email + password. Sessions are signed JWT cookies (AUTH_SECRET); the token
 * carries our own user id from the users table.
 */
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { findUserByEmail, findUserById, upsertGoogleUser, verifyPassword } from "@/lib/users";
import { DEMO_EMAIL, ensureDemoUser, signupAllowed } from "@/lib/demo";

export const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: { email: {}, password: {} },
    authorize: async (creds) => {
      const email = String(creds?.email ?? "");
      const password = String(creds?.password ?? "");
      // The demo account is created the first time someone uses it.
      if (email.trim().toLowerCase() === DEMO_EMAIL) await ensureDemoUser();
      const user = await findUserByEmail(email);
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
    // On the demo, Google sign-in works only for existing accounts and the owner's emails.
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return true;
      return signupAllowed(user.email) || !!(await findUserByEmail(user.email));
    },
    async jwt({ token, user, account }) {
      if (user) {
        // First request after sign-in: store our users-table id in the token.
        token.uid =
          account?.provider === "google" && user.email
            ? (await upsertGoogleUser({ email: user.email, name: user.name, image: user.image })).id
            : user.id;
      }
      // A valid cookie for an account that no longer exists (deleted, or from another
      // database on the same localhost) ends the session, so the user is sent to sign in.
      if (typeof token.uid !== "string" || !(await findUserById(token.uid))) return null;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});
