/**
 * Which user the current request (or background job) is working for.
 * API routes run their work inside `runAsUser`, so the store and the in-flight
 * request cache are scoped to that user without passing an id through every call.
 */
import { AsyncLocalStorage } from "node:async_hooks";

const ctx = new AsyncLocalStorage<string>();

export function runAsUser<T>(userId: string, fn: () => T): T {
  return ctx.run(userId, fn);
}

/** The signed-in user's id. Throws outside `runAsUser` (a bug: data must never be read unscoped). */
export function currentUserId(): string {
  const id = ctx.getStore();
  if (!id) throw new Error("No user in context: wrap the work in runAsUser().");
  return id;
}

/** The user's id when there is one (used for logging, which also runs in health checks). */
export function maybeUserId(): string | null {
  return ctx.getStore() ?? null;
}
