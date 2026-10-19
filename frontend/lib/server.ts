import { cookies } from "next/headers";
import type { Lang } from "@/lib/i18n";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export const getLang = async (): Promise<Lang> => ((await cookies()).get("lang")?.value === "en" ? "en" : "fa");

/** Server-side read of the public catalog. Cached for `revalidate` seconds; null when the API is down so the page still renders. */
export async function getJSON<T>(path: string, revalidate = 300): Promise<T | null> {
  try {
    const r = await fetch(`${BACKEND}/api${path}`, { next: { revalidate }, signal: AbortSignal.timeout(10_000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** The member profile, fetched per request with the visitor's session cookie. 401 when the session is gone. */
export async function getMe<T>(session: string): Promise<T | 401> {
  const r = await fetch(`${BACKEND}/api/me`, { cache: "no-store", headers: { cookie: `hr_session=${session}` }, signal: AbortSignal.timeout(10_000) });
  if (r.status === 401) return 401;
  if (!r.ok) throw new Error(`me ${r.status}`);
  return r.json();
}
