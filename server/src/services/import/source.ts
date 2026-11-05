import { createHash } from "node:crypto";
import { EMAIL, LINK, phonesIn } from "../../llm/redact";

/**
 * normalizeSource (agent spec 01-resume-parser 3.3 step 2): NFKC, \n line endings, format and control characters
 * other than tab and newline removed, runs of spaces and tabs to one space, each line trimmed, three or more blank
 * lines to one. source_hash and every offset are taken over this text.
 */
export function normalizeSource(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\p{Cf}\p{Cc}]/gu, (c) => (c === "\n" || c === "\t" ? c : ""))
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** sha256 hex of the normalized text: the identity of one import's source within a profile. */
export const sourceHash = (normalized: string): string => createHash("sha256").update(normalized, "utf8").digest("hex");

/** At most `max` characters, cut at the last line break before it. */
export function capChars(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf("\n", max);
  return text.slice(0, cut > max / 2 ? cut : max);
}

/** A LinkedIn "Save to PDF" export: its profile link and the Top Skills block or LinkedIn's page footer. */
export const isLinkedInExport = (text: string): boolean =>
  /linkedin\.com\/in\//i.test(text) && (/^Top Skills$/m.test(text) || /^Page \d+ of \d+$/m.test(text));

/** Non-space characters; a PDF with fewer than this many has no text layer (a scan). */
export const MIN_TEXT_CHARS = 100;
export const textChars = (text: string): number => text.replace(/\s/g, "").length;

export interface FoundContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: string[];
}

/**
 * Contact details in the source, offered for Profile on the confirm step and never stored as facts (PRD 6.4). Read on
 * demand from the decrypted source, so nothing new is stored. The name is the first line when it reads like one.
 */
export function contactIn(text: string): FoundContact | null {
  const first = text.split("\n").find((l) => l.trim())?.trim() ?? "";
  const name = /^\p{Lu}[\p{L}'.-]*(?: \p{Lu}[\p{L}'.-]*){1,3}$/u.test(first) ? first.slice(0, 120) : null;
  const email = text.match(EMAIL)?.[0]?.slice(0, 200) ?? null;
  const phone = phonesIn(text)[0]?.trim().slice(0, 40) ?? null;
  const links = [...new Set(text.match(LINK) ?? [])].slice(0, 6).map((l) => l.slice(0, 300));
  return name || email || phone || links.length ? { name, email, phone, location: null, links } : null;
}
