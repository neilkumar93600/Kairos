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
