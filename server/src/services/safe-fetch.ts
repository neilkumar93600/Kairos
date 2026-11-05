import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import type { IncomingHttpHeaders } from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import type { Readable } from "node:stream";
import zlib from "node:zlib";

/**
 * safeFetchJson (06-infrastructure 7.4; CISO shouldFix "route every board call through one safe fetch", mustFix 3): the
 * only outbound HTTP call the server makes to a job board. GET only, https only, port 443 only, an exact host allowlist,
 * no redirects, a streamed cap on the decompressed body, and the resolved address checked at connect time: the
 * agent's own lookup refuses a private address, and the address it checked is the address the socket connects to, so a
 * DNS answer that changes between a check and the connect (rebinding) cannot slip through.
 */

export const MiB = 1024 * 1024;
export const USER_AGENT = "KairosBot/1.0 (+https://kairos.app/bot)";

export type SafeFetchCode =
  | "ssrf_scheme"
  | "ssrf_host"
  | "ssrf_address"
  | "ssrf_redirect"
  | "response_too_large"
  | "throttled"
  | "forbidden"
  | "http_error"
  | "bad_payload"
  | "timeout"
  | "connection";

/** The message is the code (and status): never the URL or a body, so it can be stored and logged as is. */
export class SafeFetchError extends Error {
  constructor(
    readonly code: SafeFetchCode,
    readonly status?: number,
    /** 429 and 403: the Retry-After header in ms, when the server sent one. */
    readonly retryAfterMs?: number,
  ) {
    super(status ? `${code} (${status})` : code);
    this.name = "SafeFetchError";
  }
}

const BLOCKED = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT; Alibaba's metadata service lives here
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local: the cloud metadata services
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved and broadcast
] as const) {
  BLOCKED.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 96], // unspecified, loopback and IPv4-compatible
  ["64:ff9b::", 96], // NAT64 can embed a private IPv4
  ["64:ff9b:1::", 48],
  ["100::", 64], // discard
  ["2001::", 23], // IETF protocol assignments, Teredo included
  ["2001:db8::", 32],
  ["2002::", 16], // 6to4 can embed a private IPv4
  ["fc00::", 7], // unique-local: Railway's private network
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local
  ["ff00::", 8], // multicast
] as const) {
  BLOCKED.addSubnet(net, prefix, "ipv6");
}

/**
 * IPv4-mapped IPv6 (::ffff:0:0/96), refused whole: a public board never answers with one. A list of its own, because a
 * BlockList applies an IPv6 rule to IPv4 addresses in their mapped form, so in BLOCKED it would refuse every IPv4.
 */
const MAPPED = new BlockList();
MAPPED.addSubnet("::ffff:0:0", 96, "ipv6");

/** True for anything that is not a public unicast address, and for anything that is not an IP at all. */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  if (family === 6 && MAPPED.check(address, "ipv6")) return true;
  return BLOCKED.check(address, family === 4 ? "ipv4" : "ipv6");
}

/** dns.lookup with `all: true`, the one call the guarded lookup makes. Tests pass their own. */
export type Resolver = (hostname: string, options: { all: true; family?: number }, callback: (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void) => void;

const systemResolver: Resolver = (hostname, options, callback) => dnsLookup(hostname, options, callback);

/**
 * The connect-time check: net calls this lookup when the socket connects. Every resolved address must be public (one
 * private answer refuses the whole name), and the addresses handed back are the ones checked, so the socket connects
 * to an address that passed. No second resolution happens anywhere.
 */
export function guardedLookup(resolve: Resolver = systemResolver): LookupFunction {
  return ((hostname: string, options: { all?: boolean; family?: number }, callback: (...args: unknown[]) => void) => {
    resolve(hostname, { all: true, family: options?.family || undefined }, (err, addresses) => {
      if (err) return callback(err);
      if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) return callback(new SafeFetchError("ssrf_address"));
      if (options?.all) return callback(null, addresses);
      return callback(null, addresses[0]!.address, addresses[0]!.family);
    });
  }) as LookupFunction;
}

/**
 * The agent every board request uses. Its lookup is guarded, and an agent's options win over a request's when Node
 * opens the socket. maxSockets 4 is the politeness limit per host (matching-09).
 */
export function createSafeAgent(resolve?: Resolver): https.Agent {
  return new https.Agent({ keepAlive: true, maxSockets: 4, lookup: guardedLookup(resolve) });
}

let defaultAgent: https.Agent | undefined;
export const safeAgent = (): https.Agent => (defaultAgent ??= createSafeAgent());

export interface RawResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Readable;
}

/** Sends one GET. The default goes through https with the safe agent; tests pass a fake. */
export type Send = (url: URL, headers: Record<string, string>, signal: AbortSignal) => Promise<RawResponse>;

const httpsSend: Send = (url, headers, signal) =>
  new Promise((resolve, reject) => {
    const req = https.request(url, { method: "GET", headers, agent: safeAgent(), signal }, (res) =>
      resolve({ status: res.statusCode ?? 0, headers: res.headers, body: res }),
    );
    req.on("error", reject);
    req.end();
  });

export interface SafeFetchOptions {
  /** Exact host names. A literal IP is refused even when listed. */
  allowedHosts: readonly string[];
  /** Cap on the decompressed body: 2 MiB for one posting, up to 24 MiB for a Greenhouse board. */
  maxBytes: number;
  timeoutMs?: number;
  /** Sent as If-None-Match; a 304 comes back as { status: 304 }. */
  etag?: string | null;
  send?: Send;
}

export type SafeFetchResult = { status: 200; body: unknown; etag: string | null } | { status: 304 } | { status: 404 };

/** Retry-After as delta seconds or an HTTP date, in ms; undefined when absent or unreadable. */
export function parseRetryAfter(value: string | string[] | undefined, now = Date.now()): number | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) return undefined;
  if (/^\d+$/.test(v.trim())) return Number(v.trim()) * 1000;
  const at = Date.parse(v);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

function decoder(encoding: string | undefined): NodeJS.ReadWriteStream | null | undefined {
  switch ((encoding ?? "identity").trim().toLowerCase()) {
    case "identity":
    case "":
      return null;
    case "gzip":
    case "x-gzip":
      return zlib.createGunzip();
    case "deflate":
      return zlib.createInflate();
    case "br":
      return zlib.createBrotliDecompress();
    default:
      return undefined;
  }
}

/** Reads the body through its decoder, counting decompressed bytes: a gzip bomb stops at maxBytes like a plain body. */
async function readCapped(res: RawResponse, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
  const declared = Number(res.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes) {
    res.body.destroy();
    throw new SafeFetchError("response_too_large");
  }
  const decode = decoder(res.headers["content-encoding"] as string | undefined);
  if (decode === undefined) {
    res.body.destroy();
    throw new SafeFetchError("bad_payload");
  }
  const stream: Readable = decode ? res.body.pipe(decode as unknown as NodeJS.WritableStream & Readable) : res.body;
  if (decode) res.body.on("error", (err) => (decode as unknown as Readable).destroy(err));
  const onAbort = () => stream.destroy(new SafeFetchError("timeout"));
  signal.addEventListener("abort", onAbort, { once: true });
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of stream) {
      size += (chunk as Buffer).length;
      if (size > maxBytes) throw new SafeFetchError("response_too_large");
      chunks.push(chunk as Buffer);
    }
  } catch (err) {
    if (err instanceof SafeFetchError) throw err;
    if (signal.aborted) throw new SafeFetchError("timeout");
    throw new SafeFetchError(decode ? "bad_payload" : "connection");
  } finally {
    signal.removeEventListener("abort", onAbort);
    res.body.destroy();
    stream.destroy();
  }
  return Buffer.concat(chunks);
}

/** One guarded GET of a JSON document. Throws SafeFetchError; 304 and 404 come back as results. */
export async function safeFetchJson(url: string, opts: SafeFetchOptions): Promise<SafeFetchResult> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new SafeFetchError("ssrf_scheme");
  }
  if (u.protocol !== "https:" || u.port !== "" || u.username || u.password) throw new SafeFetchError("ssrf_scheme");
  if (isIP(u.hostname.replace(/^\[|\]$/g, "")) || !opts.allowedHosts.includes(u.hostname)) throw new SafeFetchError("ssrf_host");

  const headers: Record<string, string> = { accept: "application/json", "accept-encoding": "gzip, deflate, br", "user-agent": USER_AGENT };
  if (opts.etag) headers["if-none-match"] = opts.etag;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 15_000);

  let res: RawResponse;
  try {
    res = await (opts.send ?? httpsSend)(u, headers, signal);
  } catch (err) {
    if (err instanceof SafeFetchError) throw err;
    // The guarded lookup's refusal reaches here wrapped by net on some paths: keep its code.
    if ((err as { cause?: unknown }).cause instanceof SafeFetchError) throw (err as { cause: SafeFetchError }).cause;
    if (signal.aborted) throw new SafeFetchError("timeout");
    throw new SafeFetchError("connection");
  }

  const { status } = res;
  if (status === 304 || status === 404) {
    res.body.destroy();
    return { status };
  }
  if (status >= 300 && status < 400) {
    res.body.destroy();
    throw new SafeFetchError("ssrf_redirect", status);
  }
  if (status === 429 || status === 403) {
    res.body.destroy();
    throw new SafeFetchError(status === 429 ? "throttled" : "forbidden", status, parseRetryAfter(res.headers["retry-after"]));
  }
  if (status < 200 || status >= 300) {
    res.body.destroy();
    throw new SafeFetchError("http_error", status);
  }

  const raw = await readCapped(res, opts.maxBytes, signal);
  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new SafeFetchError("bad_payload");
  }
  const etag = res.headers.etag;
  return { status: 200, body, etag: typeof etag === "string" && etag.length <= 200 ? etag : null };
}
