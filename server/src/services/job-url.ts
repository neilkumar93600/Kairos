import type { AtsProvider } from "@auto-career/shared";

export interface ParsedJobUrl {
  ats: AtsProvider;
  boardToken: string;
  postingId: string;
}

const GREENHOUSE_HOSTS = new Set(["boards.greenhouse.io", "job-boards.greenhouse.io"]);
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const NUMERIC_ID = /^\d{1,15}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ok(ats: AtsProvider, boardToken: string | null | undefined, postingId: string | null | undefined, idPattern: RegExp): ParsedJobUrl | null {
  if (!boardToken || !postingId || !TOKEN.test(boardToken) || !idPattern.test(postingId)) return null;
  // Lowercase: Ashby matches a posting id exactly and its API returns lowercase UUIDs. A no-op for numeric ids.
  return { ats, boardToken, postingId: postingId.toLowerCase() };
}

/**
 * Reads a Greenhouse, Lever or Ashby posting link into the board token and posting id, or null.
 * https and exact hosts only. Employer-domain links (?gh_jid=) are null because the board token is unknown.
 */
export function parseJobUrl(url: string): ParsedJobUrl | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.port || u.username || u.password) return null;
  const parts = u.pathname.split("/").filter(Boolean);

  if (GREENHOUSE_HOSTS.has(u.hostname)) {
    if (parts.length === 3 && parts[1] === "jobs") return ok("greenhouse", parts[0], parts[2], NUMERIC_ID);
    if (parts.length === 2 && parts[0] === "embed" && parts[1] === "job_app") return ok("greenhouse", u.searchParams.get("for"), u.searchParams.get("token"), NUMERIC_ID);
    return null;
  }
  if (u.hostname === "jobs.lever.co") {
    if (parts.length === 3 && parts[2] !== "apply") return null;
    return parts.length === 2 || parts.length === 3 ? ok("lever", parts[0], parts[1], UUID) : null;
  }
  if (u.hostname === "jobs.ashbyhq.com") {
    if (parts.length === 3 && parts[2] !== "application") return null;
    return parts.length === 2 || parts.length === 3 ? ok("ashby", parts[0], parts[1], UUID) : null;
  }
  return null;
}
