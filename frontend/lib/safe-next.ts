const BASE = "http://h.invalid";

/** Post-login redirect target, same-origin paths only. Parsed the way the browser will ("/\\x", tabs, "/.//x"). */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  try {
    const u = new URL(raw, BASE);
    if (u.origin !== BASE) return fallback;
    return "/" + (u.pathname + u.search + u.hash).replace(/^\/+/, ""); // collapse "//host" so it can't turn protocol-relative
  } catch {
    return fallback;
  }
}
