import type { AtsProvider } from "@auto-career/shared";

/** A posting in one shape, whatever board it came from. */
export interface NormalizedJob {
  externalId: string;
  title: string;
  location: string | null;
  remote: boolean;
  department: string | null;
  descriptionText: string;
  applyUrl: string;
  postedAt: Date | null;
  salaryMinUsd: number | null;
  salaryMaxUsd: number | null;
  raw: unknown;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface AtsAdapter {
  provider: AtsProvider;
  /** Reads every open posting on a public board. Throws BoardNotFoundError on 404. */
  fetchBoard(boardToken: string, fetchImpl?: FetchLike): Promise<NormalizedJob[]>;
  /** Reads one posting by its board id, or null when it is missing or closed. Only calls the provider's public API. */
  fetchPosting(boardToken: string, postingId: string, fetchImpl?: FetchLike): Promise<NormalizedJob | null>;
}

export class BoardNotFoundError extends Error {
  constructor(provider: AtsProvider, boardToken: string) {
    super(`${provider} board not found: ${boardToken}`);
    this.name = "BoardNotFoundError";
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * Turns board HTML into plain text, keeping paragraph breaks. Greenhouse sends HTML that is itself
 * entity-encoded (so "&" arrives as "&amp;amp;"), hence a second decode after tags are stripped.
 */
export function htmlToText(html: string): string {
  const stripped = decodeEntities(html)
    .replace(/<\s*(br|\/p|\/li|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(stripped)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export function looksRemote(...values: (string | null | undefined)[]): boolean {
  return values.some((v) => (v ? /\bremote\b/i.test(v) : false));
}

/** Every board request goes through here. A board that hangs fails after 15 s instead of holding an import or a poll. */
export async function getJson(url: string, fetchImpl: FetchLike): Promise<{ status: number; body: unknown }> {
  const res = await fetchImpl(url, {
    headers: { accept: "application/json", "user-agent": "KairosBot/1.0 (+https://kairos.app/bot)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) return { status: 404, body: null };
  if (!res.ok) throw new Error(`GET ${url} failed with ${res.status}`);
  return { status: res.status, body: await res.json() };
}
