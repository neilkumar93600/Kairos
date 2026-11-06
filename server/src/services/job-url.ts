import type { AtsProvider } from "@auto-career/shared";

export interface ParsedJobUrl {
  ats: AtsProvider;
  boardToken: string;
  postingId: string;
  /** Set only for a Lever EU link (jobs.eu.lever.co); everything else is the US region. */
  region?: "eu";
}

const GREENHOUSE_HOSTS = new Set(["boards.greenhouse.io", "job-boards.greenhouse.io"]);
const LEVER_HOSTS: Record<string, ParsedJobUrl["region"]> = { "jobs.lever.co": undefined, "jobs.eu.lever.co": "eu" };
/** companies_board_token_ck allows "." too (matching-82); the first character stays alphanumeric, so "." and ".." never form a segment. */
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const NUMERIC_ID = /^\d{1,15}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ok(ats: AtsProvider, boardToken: string | null | undefined, postingId: string | null | undefined, idPattern: RegExp): ParsedJobUrl | null {
  if (!boardToken || !postingId || !TOKEN.test(boardToken) || !idPattern.test(postingId)) return null;
  // Lowercase: Ashby matches a posting id exactly and its API returns lowercase UUIDs. A no-op for numeric ids.
  return { ats, boardToken, postingId: postingId.toLowerCase() };
}

function parseHttps(url: string): URL | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  return u.protocol === "https:" && !u.port && !u.username && !u.password ? u : null;
}

/**
 * Reads a Greenhouse, Lever or Ashby posting link into the board token and posting id, or null.
 * https and exact hosts only. Employer-domain links (?gh_jid=) are null here: see employerLink.
 */
export function parseJobUrl(url: string): ParsedJobUrl | null {
  const u = parseHttps(url);
  if (!u) return null;
  const parts = u.pathname.split("/").filter(Boolean);

  if (GREENHOUSE_HOSTS.has(u.hostname)) {
    if (parts.length === 3 && parts[1] === "jobs") return ok("greenhouse", parts[0], parts[2], NUMERIC_ID);
    if (parts.length === 2 && parts[0] === "embed" && parts[1] === "job_app") return ok("greenhouse", u.searchParams.get("for"), u.searchParams.get("token"), NUMERIC_ID);
    return null;
  }
  if (u.hostname in LEVER_HOSTS) {
    if (parts.length === 3 && parts[2] !== "apply") return null;
    const parsed = parts.length === 2 || parts.length === 3 ? ok("lever", parts[0], parts[1], UUID) : null;
    const region = LEVER_HOSTS[u.hostname];
    return parsed && region ? { ...parsed, region } : parsed;
  }
  if (u.hostname === "jobs.ashbyhq.com") {
    if (parts.length === 3 && parts[2] !== "application") return null;
    return parts.length === 2 || parts.length === 3 ? ok("ashby", parts[0], parts[1], UUID) : null;
  }
  return null;
}

export interface EmployerLink {
  /** Lower case, "www." dropped: compared with companies.domains and the careers_url host. */
  host: string;
  /** Path only, no query string: what a board_requests row may hold. */
  path: string;
  /** "greenhouse" when the link carries gh_jid; the posting id it names. */
  detectedAts: "greenhouse" | null;
  postingId: string | null;
}

const HOST_RE = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/;
const PATH_KEEP = /[A-Za-z0-9._~%/+=@:,-]/;

/** Path cut to board_requests_path_ck: other characters percent-encoded, at most 200 characters, never a split escape. */
function safePath(pathname: string): string {
  let out = "";
  for (const ch of pathname) {
    const piece = PATH_KEEP.test(ch) ? ch : encodeURIComponent(ch).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
    if (out.length + piece.length > 200) break;
    out += piece;
  }
  return out.startsWith("/") ? out : `/${out}`.slice(0, 200);
}

/**
 * An https link on any other host, read without fetching it (B.8.6 forbids fetching a pasted URL; matching-87): the
 * normalized host and path for the owner's review queue, and the Greenhouse posting id when the employer's careers page
 * carries ?gh_jid=. Null for a non-https link, an IP host or a host that board_requests_host_ck would refuse.
 */
export function employerLink(url: string): EmployerLink | null {
  const u = parseHttps(url);
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!HOST_RE.test(host) || /^[0-9.]+$/.test(host) || host.startsWith("[")) return null;
  const jid = u.searchParams.get("gh_jid");
  const postingId = jid && NUMERIC_ID.test(jid) ? jid : null;
  return { host, path: safePath(u.pathname), detectedAts: postingId ? "greenhouse" : null, postingId };
}
