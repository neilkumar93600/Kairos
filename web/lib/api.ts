/** Client for the Express API. Same-origin: next.config.ts rewrites /api/* to Railway. */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    // FormData needs the browser's own multipart boundary, so it gets no JSON content-type.
    headers: { ...(init.body instanceof FormData ? {} : { "content-type": "application/json" }), ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string; details?: unknown } } | null;
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code ?? "unknown", body?.error?.message ?? "Could not reach Kairos right now. Try again in a moment.", body?.error?.details);
  }
  return body as T;
}

export const post = <T>(path: string, data?: unknown) => api<T>(path, { method: "POST", body: data === undefined || data instanceof FormData ? (data as FormData | undefined) : JSON.stringify(data) });
export const put = <T>(path: string, data: unknown) => api<T>(path, { method: "PUT", body: JSON.stringify(data) });
export const patch = <T>(path: string, data: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(data) });
