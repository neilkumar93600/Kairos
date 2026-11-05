import type { AtsProvider } from "@auto-career/shared";
import { MiB, safeFetchJson, type SafeFetchOptions, type SafeFetchResult } from "../safe-fetch";

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

export type Region = "us" | "eu";

/** The guarded fetch (services/safe-fetch.ts). Adapters take it as a parameter so tests can stand in for the network. */
export type Fetcher = (url: string, opts: SafeFetchOptions) => Promise<SafeFetchResult>;

export interface BoardRequest {
  /** Lever only: api.eu.lever.co for an EU board (companies.api_region). */
  region?: Region;
  /** companies.etag: a 304 answers not_modified. */
  etag?: string | null;
  fetcher?: Fetcher;
}

export type BoardResult = { kind: "not_modified" } | { kind: "listing"; postings: NormalizedJob[]; etag: string | null };

export interface AtsAdapter {
  provider: AtsProvider;
  /** Reads every open posting on a public board. Throws BoardNotFoundError on 404 and SafeFetchError on a refused fetch. */
  fetchBoard(boardToken: string, req?: BoardRequest): Promise<BoardResult>;
  /** Reads one posting by its board id, or null when it is missing or closed. Only calls the provider's public API. */
  fetchPosting(boardToken: string, postingId: string, req?: Omit<BoardRequest, "etag">): Promise<NormalizedJob | null>;
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

/** One posting: well under 2 MiB on every board. */
export const POSTING_MAX_BYTES = 2 * MiB;

/**
 * Every board request goes through here and through safeFetchJson: the exact API host of the adapter, a byte cap, and a
 * timeout, so a board that hangs fails instead of holding an import or a poll.
 */
export async function getJson(url: string, opts: { host: string; maxBytes: number; timeoutMs?: number; etag?: string | null; fetcher?: Fetcher }): Promise<SafeFetchResult> {
  return (opts.fetcher ?? safeFetchJson)(url, { allowedHosts: [opts.host], maxBytes: opts.maxBytes, timeoutMs: opts.timeoutMs ?? 15_000, etag: opts.etag ?? null });
}
