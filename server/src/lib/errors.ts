/** An error that maps to an HTTP status and a stable code the web app can switch on. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (what: string) => new HttpError(404, "not_found", `${what} not found`);
export const forbidden = (message = "Not allowed") => new HttpError(403, "forbidden", message);
export const paymentRequired = (message: string) => new HttpError(402, "payment_required", message);
export const conflict = (message: string) => new HttpError(409, "conflict", message);

/** The next 00:00 UTC, when daily AI allowances and per-user spend caps reset, as 2026-10-24T00:00:00Z. */
export const nextUtcMidnight = (now = new Date()): string =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString().replace(".000Z", "Z");
