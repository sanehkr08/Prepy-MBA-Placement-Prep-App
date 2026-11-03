"use client";

/** Fetch JSON from an API route; throws an Error with the server's message. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const serverMsg =
      body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : "";
    const msg = serverMsg || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

const LAST_JD_KEY = "prepy:lastJd";

export function rememberJD(id: string) {
  try {
    localStorage.setItem(LAST_JD_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

export function lastJD(): string | null {
  try {
    return localStorage.getItem(LAST_JD_KEY);
  } catch {
    return null;
  }
}
