export class ApiError extends Error {
  constructor(public status: number, message: string, public retryAfter = 0) { super(message); }
}

// The session lives in an HttpOnly cookie the browser sends itself, so no token ever touches JS (XSS cannot read it).
export async function api<T = any>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.detail === "string" ? data.detail : "error", +(res.headers.get("retry-after") ?? 0));
  return data;
}
