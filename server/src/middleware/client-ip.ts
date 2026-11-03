import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { NextFunction, Request, Response } from "express";

/** Set by the web edge (web/proxy.ts) on every /api rewrite. */
const EDGE_HEADER = "x-kairos-edge";
/** After clientIpResolver, the one header Better Auth and every limiter read the client address from. */
export const CLIENT_IP_HEADER = "x-kairos-client-ip";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Resolves the client address once per request (05-api 5.5, CISO mustFix 4) and writes it to x-kairos-client-ip.
 * A request whose x-kairos-edge equals KAIROS_EDGE_SECRET came through the web edge, which copied Vercel's x-real-ip
 * into x-kairos-client-ip. Anything else (the extension, webhooks, a direct caller) gets the X-Forwarded-For entry
 * Railway's edge appended: the rightmost, after skipping `hops` inner proxies. Entries left of it, x-vercel-id and
 * client-sent x-kairos-* headers are never used. The secret is removed so no handler or log line ever sees it.
 */
export function clientIpResolver(edgeSecret: string | undefined, hops = 0) {
  // Digests on both sides: equal lengths for timingSafeEqual, and the secret's length stays hidden.
  const expected = edgeSecret ? digest(edgeSecret) : undefined;
  return (req: Request, _res: Response, next: NextFunction) => {
    const edge = req.headers[EDGE_HEADER];
    const claimed = req.headers[CLIENT_IP_HEADER];
    const fromEdge = expected !== undefined && typeof edge === "string" && timingSafeEqual(digest(edge), expected);
    delete req.headers[EDGE_HEADER];
    req.headers[CLIENT_IP_HEADER] = fromEdge && typeof claimed === "string" && isIP(claimed) ? claimed : forwardedHop(req, hops);
    next();
  };
}

/** The hop Railway's edge appended; without X-Forwarded-For (local runs, tests), the socket peer. */
function forwardedHop(req: Request, hops: number): string {
  const hop = String(req.headers["x-forwarded-for"] ?? "").split(",").map((s) => s.trim()).at(-1 - hops);
  return hop && isIP(hop) ? hop : (req.socket.remoteAddress ?? "unknown");
}

/** The resolved client address. createApp mounts clientIpResolver first, so it is always set behind it. */
export const clientIp = (req: Request): string => String(req.headers[CLIENT_IP_HEADER]);
