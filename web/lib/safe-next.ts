const BASE = "http://kairos.invalid";

/**
 * The ?next= target after sign-in, limited to this site. Parsed with URL rather than a regex: browsers strip tabs and
 * newlines from URLs, so "/\t/evil.com" would pass a "starts with one slash" check and still leave the site.
 */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  try {
    const url = new URL(raw, BASE);
    return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
