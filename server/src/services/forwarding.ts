import { createHash, createPublicKey, verify, type KeyObject } from "node:crypto";
import { Resolver } from "node:dns/promises";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import type { Rendered } from "../jobs/notify";
import { parseAddress } from "./linker";

/**
 * Gmail forwarding confirmations (messaging-34..36, v01; workers/10-inbound-email.md 3.4). Before Gmail forwards to a
 * new address it mails that address a code and a link; Kairos receives it for the user, shows both in the app and
 * emails them to the account address. A confirmation counts only with a valid DKIM signature by google.com over its
 * From and To headers and its whole body, checked here on Postmark's RawEmail: without it anyone could mail a
 * "confirmation" with a phishing link and have Kairos relay it, and the To check stops a genuine one being replayed to
 * another user's address. Mail claiming Google's forwarding sender without that signature is proven forged and is stored
 * hidden with no body, so its link shows nowhere (stricter than 3.4's "treat as ordinary": the inbox preview would show
 * the link). Template details (subject, code length, link hosts) are pinned by the S-G1 sample (owner-actions/WP-24.md).
 */

export const GMAIL_FORWARDING_SENDER = "forwarding-noreply@google.com";
const GMAIL_DKIM_DOMAIN = "google.com";
/** The only hosts a confirmation link may point at; any other link is dropped and only the code kept [verify in S-G1]. */
export const FORWARDING_LINK_HOSTS = new Set(["mail-settings.google.com", "mail.google.com"]);
export const FORWARDING_CODE_TTL_MS = 3 * 24 * 3600_000;

export interface ForwardingConfirmation {
  code: string | null;
  confirmUrl: string | null;
}

/** A DKIM public key by its DNS name (`<selector>._domainkey.<domain>`); null when there is none. */
export type KeyLookup = (name: string) => Promise<KeyObject | null>;

/** "(#123456789) Gmail Forwarding Confirmation - Receive Mail from ..." [S-G1]. */
const CONFIRMATION_SUBJECT = /^\s*(?:\(#\d{6,12}\)\s*)?Gmail Forwarding Confirmation\b/i;

/**
 * Only mail from Google's forwarding sender is looked at, so ordinary mail costs no DNS lookup. `null`: not from that
 * sender, or genuine but not a confirmation (ordinary mail). `"forged"`: claims that sender without a valid signature.
 * Otherwise the code and allowlisted link. `recipient` is the forwarding address the mail was delivered to.
 */
export async function parseGmailForwardingConfirmation(
  mail: { from: string; subject: string; textBody: string; rawEmail?: string; recipient: string },
  lookup: KeyLookup = dnsKeyLookup,
): Promise<ForwardingConfirmation | "forged" | null> {
  if (parseAddress(mail.from)?.address !== GMAIL_FORWARDING_SENDER) return null;
  if (!mail.rawEmail || !(await verifyDkim(mail.rawEmail, GMAIL_DKIM_DOMAIN, GMAIL_FORWARDING_SENDER, mail.recipient, lookup))) return "forged";
  if (!CONFIRMATION_SUBJECT.test(mail.subject)) return null;
  const code = (mail.textBody.match(/Confirmation code:\s*(\d{6,12})\b/i) ?? mail.subject.match(/\(#(\d{6,12})\)/))?.[1] ?? null;
  const confirmUrl = [...mail.textBody.matchAll(/https:\/\/[^\s<>"')\]]+/g)].map((m) => m[0]).find(allowedLink) ?? null;
  return code || confirmUrl ? { code, confirmUrl } : null;
}

function allowedLink(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && FORWARDING_LINK_HOSTS.has(url.hostname) && href.length <= 2048;
  } catch {
    return false;
  }
}

// ---------- DKIM (RFC 6376), the subset Gmail uses: rsa-sha256, simple or relaxed canonicalization ----------

type Field = { name: string; raw: string };

/** Header fields in order, each with its folded raw text (no trailing CRLF), and the body. */
function splitMessage(raw: string): { fields: Field[]; body: string } {
  const msg = raw.includes("\r\n") ? raw : raw.replace(/\n/g, "\r\n");
  const end = msg.indexOf("\r\n\r\n");
  const head = end < 0 ? msg : msg.slice(0, end);
  const body = end < 0 ? "" : msg.slice(end + 4);
  const fields = head
    .split(/\r\n(?![ \t])/)
    .filter((f) => f.includes(":"))
    .map((raw) => ({ name: raw.slice(0, raw.indexOf(":")).trim().toLowerCase(), raw }));
  return { fields, body };
}

function canonHeader(raw: string, relaxed: boolean): string {
  if (!relaxed) return raw;
  const colon = raw.indexOf(":");
  const value = raw
    .slice(colon + 1)
    .replace(/\r\n(?=[ \t])/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  return `${raw.slice(0, colon).trim().toLowerCase()}:${value}`;
}

function canonBody(body: string, relaxed: boolean): string {
  const text = relaxed ? body.split("\r\n").map((l) => l.replace(/[ \t]+/g, " ").replace(/ $/, "")).join("\r\n") : body;
  const trimmed = text.replace(/(?:\r\n)*$/, "");
  return trimmed === "" ? (relaxed ? "" : "\r\n") : `${trimmed}\r\n`;
}

/** The tag=value list of a DKIM-Signature or key record; whitespace inside values (folding) removed. */
function tags(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of value.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) out[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).replace(/\s+/g, "");
  }
  return out;
}

/** Signatures tried per message: a mail cannot make one request run dozens of DNS lookups. */
const MAX_SIGNATURES = 5;
const headerValue = (f: Field) => f.raw.slice(f.raw.indexOf(":") + 1);

/**
 * True when one DKIM-Signature of `domain` (exactly, not a subdomain) verifies, signs the From and To headers and the
 * whole body (no l= tag), has not expired, and the message has exactly one From, whose address is `fromAddress`, and
 * one To, which names `toAddress`.
 */
export async function verifyDkim(raw: string, domain: string, fromAddress: string, toAddress: string, lookup: KeyLookup): Promise<boolean> {
  const { fields, body } = splitMessage(raw);
  const froms = fields.filter((f) => f.name === "from");
  const tos = fields.filter((f) => f.name === "to");
  if (froms.length !== 1 || parseAddress(headerValue(froms[0]!))?.address !== fromAddress) return false;
  if (tos.length !== 1 || !headerValue(tos[0]!).toLowerCase().includes(toAddress.toLowerCase())) return false;

  for (const sig of fields.filter((f) => f.name === "dkim-signature").slice(0, MAX_SIGNATURES)) {
    const t = tags(headerValue(sig));
    const signed = (t.h ?? "").toLowerCase().split(":").filter(Boolean);
    if (t.v !== "1" || t.a !== "rsa-sha256" || t.d?.toLowerCase() !== domain || t.l !== undefined || !t.b || !t.bh) continue;
    if (!signed.includes("from") || !signed.includes("to") || !/^[A-Za-z0-9._-]{1,63}$/.test(t.s ?? "")) continue;
    if (t.x && Number(t.x) * 1000 < Date.now()) continue;
    const [hc, bc = "simple"] = (t.c ?? "simple/simple").toLowerCase().split("/");
    if (!["simple", "relaxed"].includes(hc!) || !["simple", "relaxed"].includes(bc)) continue;
    if (createHash("sha256").update(canonBody(body, bc === "relaxed")).digest("base64") !== t.bh) continue;

    // Each name in h= takes the last instance not yet used, bottom up; a name with none left signs nothing.
    const used = new Set<Field>();
    const lines: string[] = [];
    for (const name of signed) {
      const field = fields.findLast((f) => f.name === name && !used.has(f));
      if (!field) continue;
      used.add(field);
      lines.push(`${canonHeader(field.raw, hc === "relaxed")}\r\n`);
    }
    // The signature's own field with b= emptied, last and without its CRLF.
    lines.push(canonHeader(sig.raw.replace(/([;:][ \t\r\n]*b[ \t\r\n]*=)[^;]*/, "$1"), hc === "relaxed"));

    const key = await lookup(`${t.s}._domainkey.${domain}`);
    if (key && verify("sha256", Buffer.from(lines.join("")), key, Buffer.from(t.b, "base64"))) return true;
  }
  return false;
}

/** The key record's RSA key (2048 bits at Google), or null when there is none, it is revoked or it is too short. */
export function keyFromRecord(record: string): KeyObject | null {
  const t = tags(record);
  if ((t.k ?? "rsa") !== "rsa" || !t.p) return null;
  const der = Buffer.from(t.p, "base64");
  for (const type of ["spki", "pkcs1"] as const) {
    try {
      const key = createPublicKey({ key: der, format: "der", type });
      return (key.asymmetricKeyDetails?.modulusLength ?? 0) >= 1024 ? key : null;
    } catch {
      // try the other encoding
    }
  }
  return null;
}

const resolver = new Resolver({ timeout: 2_000, tries: 2 });

/**
 * DNS TXT lookup. No such name is no key (the mail counts as unverified); any other DNS failure throws, so the
 * webhook answers 500 and Postmark retries rather than filing a real confirmation as ordinary mail.
 */
export async function dnsKeyLookup(name: string): Promise<KeyObject | null> {
  try {
    const records = await resolver.resolveTxt(name);
    for (const chunks of records) {
      const key = keyFromRecord(chunks.join(""));
      if (key) return key;
    }
    return null;
  } catch (err) {
    if (["ENOTFOUND", "ENODATA"].includes((err as { code?: string }).code ?? "")) return null;
    throw err;
  }
}

// ---------- The forwarding_code email (WP-44 notify core) ----------

/**
 * Renders `forwarding_code` for entity `<userId>:gmail:<receivedAt epoch seconds>` (_db/messaging.md 5.2) from the live
 * forwarding_verifications row. A code that expired or was replaced by a newer one is skipped, not sent.
 */
export async function renderForwardingCode(entityId: string, userId: string | null): Promise<Rendered> {
  const m = entityId.match(/^(.+):gmail:(\d{1,12})$/);
  if (!m || m[1] !== userId) return { skip: "bad_entity" };
  const { rows } = await db().execute<{ code: string | null; confirm_url: string | null; email: string; expires_at: string }>(sql`
    SELECT v.code, v.confirm_url, u.email, to_char(v.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI "UTC"') AS expires_at
      FROM forwarding_verifications v
      JOIN "user" u ON u.id = v.user_id
     WHERE v.user_id = ${m[1]} AND v.provider = 'gmail' AND v.expires_at > now()
       AND floor(extract(epoch FROM v.received_at))::bigint = ${Number(m[2])}`);
  const v = rows[0];
  if (!v) return { skip: "expired" };
  const lines = [
    "Gmail sent a confirmation to your Kairos forwarding address, so Gmail can forward your job replies to Kairos.",
    "",
    ...(v.code ? [`Confirmation code: ${v.code}`] : []),
    ...(v.confirm_url ? ["", "Or confirm with Google's link:", v.confirm_url] : []),
    "",
    `It works until ${v.expires_at}. You can also find it in Kairos under Settings, Reply forwarding.`,
    "If you did not set up forwarding in Gmail, ignore this email; nothing is forwarded until you confirm.",
  ];
  return { to: v.email, subject: "Your Gmail forwarding confirmation code", text: lines.join("\n") };
}
