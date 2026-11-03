import type { DefaultSession } from "next-auth";

// Our users-table id is added to the session in src/auth.ts.
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
