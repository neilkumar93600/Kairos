import { sql } from "drizzle-orm";
import type { Db } from "../db/client";

/**
 * Reply linking (messaging-21, 22; workers/10-inbound-email.md 3.5): which of the user's sent applications a forwarded
 * reply is about. Domain first, then the ATS's mail domain with the company named, then the company name alone. Names
 * match on whole words only, so "Box" never matches "Dropbox" and "Scale" never matches "Scalable"; a name shorter than
 * 6 characters links only together with a domain. pickLink is pure (test/fixtures/inbox/linker-golden.json).
 */

export type LinkedBy = "domain" | "company_name" | "none";

export interface LinkCandidate {
  applicationId: string;
  status: string;
  submittedAt: Date | null;
  approvedAt: Date | null;
  companyId: string;
  companyName: string;
  ats: string;
  /** companies.domains: lower-case employer mail domains. */
  domains: string[];
  jobTitle: string;
}

export interface LinkInput {
  /** The From header as received. */
  sender: string;
  subject: string;
  /** stripQuoted(body). */
  body: string;
  /** "user".email, to tell the user's own manual forward from the employer's mail. */
  accountEmail: string | null;
  /** spam_score >= 5: never link by company name alone. */
  restricted: boolean;
}

export interface LinkResult {
  applicationId: string | null;
  linkedBy: LinkedBy;
}

/** Never link by domain: anyone can send from these (spec 3.5). */
export const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "proton.me",
  "protonmail.com", "aol.com", "gmx.com", "zoho.com", "yandex.com", "rediffmail.com",
]);

/** The ATS that relays mail from a host ending in each of these [verify on the beta sample]. */
export const ATS_MAIL_DOMAINS: Record<string, string> = {
  "greenhouse-mail.io": "greenhouse",
  "greenhouse.io": "greenhouse",
  "hire.lever.co": "lever",
  "lever.co": "lever",
  "ashbyhq.com": "ashby",
};

const NAME_SUFFIXES = new Set(["inc", "llc", "ltd", "corp"]);
const BODY_SCAN = 4000;

/** Lower case, punctuation to spaces, single spaces: the form names and text are compared in. */
const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** A company name without its Inc/LLC/Ltd/Corp suffix, in `words` form. */
export function normalizeName(name: string): string {
  const parts = words(name).split(" ");
  while (parts.length > 1 && NAME_SUFFIXES.has(parts.at(-1)!)) parts.pop();
  return parts.join(" ");
}

/** True when `name` (normalized) appears in `text` as whole words. */
export const containsName = (text: string, name: string) => name !== "" && ` ${words(text)} `.includes(` ${name} `);

const ADDRESS = /<?([^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+?)>?\s*$/;

/** `{ address, name }` of a From value such as `"Acme Talent" <jobs@acme.com>` or `jobs@acme.com`. */
export function parseAddress(from: string): { address: string; name: string } | null {
  const m = from.trim().match(ADDRESS);
  if (!m) return null;
  const name = from
    .slice(0, from.lastIndexOf(m[0]))
    .trim()
    .replace(/^"|"$/g, "")
    .trim();
  return { address: m[1]!.toLowerCase(), name };
}

/** The forwarded block's From line: Gmail's "Forwarded message" header, or Outlook's From: then Sent:. */
const GMAIL_FORWARD = /^-{5,}\s*Forwarded message\s*-{5,}\s*\n(?:.*\n){0,2}?\s*\*?From:\*?\s*([^\n]+)/im;
const OUTLOOK_FORWARD = /^\s*\*?From:\*?\s*([^\n]+)\n\s*\*?Sent:\*?/im;

/**
 * The employer's address for a manual forward (messaging-22): when the mail comes from the user's own account address
 * or a free-mail address and holds a forwarded-header block, the block's From; otherwise the From header itself.
 */
export function originalSender(sender: string, body: string, accountEmail: string | null): { address: string; name: string } | null {
  const from = parseAddress(sender);
  const host = from?.address.split("@")[1] ?? "";
  if (from && from.address !== accountEmail?.toLowerCase() && !FREE_MAIL_DOMAINS.has(host)) return from;
  const block = body.match(GMAIL_FORWARD) ?? body.match(OUTLOOK_FORWARD);
  return (block && parseAddress(block[1]!)) ?? from;
}

/** `mail.acme.com` gives `mail.acme.com` and `acme.com`: every suffix with at least two labels. */
export function hostSuffixes(host: string): string[] {
  const labels = host.toLowerCase().split(".");
  return labels.slice(0, -1).map((_, i) => labels.slice(i).join("."));
}

const STATUS_ORDER: Record<string, number> = { submitted: 0, submitting: 1, failed: 2 };
const sentAt = (c: LinkCandidate) => (c.submittedAt ?? c.approvedAt)?.getTime() ?? 0;

/** Within one company: the job title sharing 2 or more words with the subject, else submitted first, then the newest. */
function pickApplication(rows: LinkCandidate[], subject: string): string {
  const subjectWords = new Set(words(subject).split(" "));
  const overlap = (c: LinkCandidate) => new Set(words(c.jobTitle).split(" ").filter((w) => w.length > 1 && subjectWords.has(w))).size;
  return [...rows].sort(
    (a, b) =>
      Number(overlap(b) >= 2) - Number(overlap(a) >= 2) ||
      (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
      sentAt(b) - sentAt(a),
  )[0]!.applicationId;
}

/** The candidates of exactly one company, or null when none or several companies matched. */
function oneCompany(rows: LinkCandidate[]): LinkCandidate[] | null {
  return new Set(rows.map((c) => c.companyId)).size === 1 ? rows : null;
}

export function pickLink(input: LinkInput, candidates: LinkCandidate[]): LinkResult {
  const none: LinkResult = { applicationId: null, linkedBy: "none" };
  if (!candidates.length) return none;
  const from = originalSender(input.sender, input.body, input.accountEmail);
  const host = from?.address.split("@")[1] ?? "";
  const suffixes = hostSuffixes(host);

  // Tier 1: the employer's own domain.
  if (host && !FREE_MAIL_DOMAINS.has(host)) {
    const hit = oneCompany(candidates.filter((c) => c.domains.some((d) => suffixes.includes(d))));
    if (hit) return { applicationId: pickApplication(hit, input.subject), linkedBy: "domain" };
  }

  // Tier 2: an ATS's relay domain, confirmed by the company named in the display name or subject.
  const ats = suffixes.map((s) => ATS_MAIL_DOMAINS[s]).find(Boolean);
  if (ats) {
    const said = `${from?.name ?? ""}\n${input.subject}`;
    const hit = oneCompany(candidates.filter((c) => c.ats === ats && containsName(said, normalizeName(c.companyName))));
    if (hit) return { applicationId: pickApplication(hit, input.subject), linkedBy: "domain" };
  }

  // Tier 3: a name of 6 or more characters in the subject or body; never for likely spam.
  if (input.restricted) return none;
  const text = `${input.subject}\n${input.body.slice(0, BODY_SCAN)}`;
  const hit = oneCompany(
    candidates.filter((c) => {
      const name = normalizeName(c.companyName);
      return name.length >= 6 && containsName(text, name);
    }),
  );
  return hit ? { applicationId: pickApplication(hit, input.subject), linkedBy: "company_name" } : none;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * The user's applications a reply can be about: sent, being sent, or failed with an ambiguous code (the employer may
 * have received it), touched in the last 180 days (applications_user_status_updated_idx).
 */
export async function linkCandidates(database: Db | Tx, userId: string): Promise<LinkCandidate[]> {
  const { rows } = await database.execute<{
    application_id: string;
    status: string;
    submitted_at: string | null;
    approved_at: string | null;
    company_id: string;
    company_name: string;
    ats: string;
    domains: string[];
    job_title: string;
  }>(sql`
    SELECT a.id AS application_id, a.status, a.submitted_at, a.approved_at, c.id AS company_id, c.name AS company_name, c.ats, c.domains,
           j.title AS job_title
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      JOIN companies c ON c.id = j.company_id
     WHERE a.user_id = ${userId}
       AND (a.status IN ('submitted', 'submitting') OR (a.status = 'failed' AND a.failure_code IN ('unconfirmed', 'timeout', 'no_report')))
       AND a.updated_at > now() - interval '180 days'
     ORDER BY a.updated_at DESC
     LIMIT 500`);
  return rows.map((r) => ({
    applicationId: r.application_id,
    status: r.status,
    submittedAt: r.submitted_at ? new Date(r.submitted_at) : null,
    approvedAt: r.approved_at ? new Date(r.approved_at) : null,
    companyId: r.company_id,
    companyName: r.company_name,
    ats: r.ats,
    domains: r.domains,
    jobTitle: r.job_title,
  }));
}
