import { createHmac } from "node:crypto";
import { env } from "../lib/env";

/**
 * PII redaction (03-agent-runtime.md 10.2). Contact details and identity never reach a model; a
 * unit test seeds every pattern and asserts nothing survives.
 */

export const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE = /\+?\d[\d ().-]{7,}\d/g;
/** Links: a scheme or www., or a bare domain on a common TLD followed by a path ("github.com/jane", not "Node.js/Express"). */
export const LINK = /\b(?:https?:\/\/|www\.)[^\s,;)]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|dev|ai|co|app|me|in|us|uk|edu|gov)\/[^\s,;)]*/gi;
/** Phone-shaped runs with at least 9 digits; "2019 - 2023" has 8 and stays a date range. */
const isPhone = (run: string) => run.replace(/\D/g, "").length >= 9;
export const phonesIn = (text: string): string[] => (text.match(PHONE) ?? []).filter(isPhone);
/** A number, one to four capitalized words and a street word, on one line: "1234 Market Street", "12 Main Road". */
const ADDRESS = /\b\d{1,5}(?:[ \t]+[A-Z][\w.'-]*){1,4}[ \t]+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Lane|Ln\.?|Drive|Dr\.?|Court|Ct\.?|Boulevard|Blvd\.?|Way|Place|Pl\.?|Sector|Nagar|Marg)\b/g;

/** Replaces emails, phone numbers, links and street-address patterns with [email], [phone], [link], [address]. */
export function redactContact(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(LINK, "[link]")
    .replace(ADDRESS, "[address]")
    .replace(PHONE, (run) => (isPhone(run) ? "[phone]" : run));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Removes the resume's contact header: the profile's name, email, phone and link hosts, matched as whole words in any
 * case, then redactContact on the rest; a line left with only redactions goes. Used before resume-parser.
 */
export function redactResumeHeader(
  text: string,
  profile: { name: string; email: string; phone?: string; links: string[] },
): string {
  let clean = text;
  const hosts = profile.links.map((l) => l.trim().replace(/^https?:\/\/(?:www\.)?/i, "").replace(/\/+$/, ""));
  const literals = [profile.name, profile.email, profile.phone, ...hosts]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v))
    .sort((a, b) => b.length - a.length);
  for (const literal of literals) clean = clean.replace(new RegExp(`(?<!\\w)${escapeRe(literal)}(?!\\w)`, "gi"), "[contact]");
  return redactContact(clean)
    .split("\n")
    .filter((line) => !/^[\s|•·,]*(?:\[(?:contact|email|phone|link|address)\][\s|•·,]*)+$/.test(line))
    .join("\n");
}

/**
 * Personal-details lines no parser needs (CISO mustFix 6, INV-9): visa and work authorization, date of birth, salary or
 * CTC, government ids, disability, veteran status, gender, ethnicity, plus age, nationality, marital status and religion.
 * A "Label: value" field counts at the line start or after a separator ("Phone: x | DOB: y"); phrases and id shapes
 * count anywhere. The whole line goes.
 * ponytail: keyword lines, kept clear of tech-resume words (race conditions, Visa the network, passport.js, pan-India).
 * A false positive costs the user one fact to add by hand; a false negative sends the line to the model. Broad wins.
 */
const SENSITIVE_LINE: RegExp[] = [
  /(?:^|[|•·;,]\s*)[-*•]?\s*(?:date of birth|d\.?o\.?b\.?|birth ?date|age|nationality|citizenship|visa(?: status| type)?|work (?:authori[sz]ation|permit|status)|immigration(?: status)?|gender|sex|pronouns?|marital status|religion|caste|ethnicity|race|disability(?: status)?|veteran(?: status)?|passport(?: no\.?| number)?|ssn|social security(?: number| no\.?)?|aadhaa?r(?: no\.?| number)?|pan(?: card| no\.?| number)?|national id|driver'?s licen[cs]e(?: no\.?| number)?|(?:current|expected|desired|present) (?:ctc|salary|compensation|pay|package)|ctc|salary(?: expectations?| expected| range)?|father'?s name)\s*(?::|=|[-–]\s)/i,
  /\b(?:date of birth|born on|dob|(?:authori[sz]ed|eligible|legally (?:able|allowed)|permitted|right) to work|work (?:authori[sz]ation|permit)|(?:visa|immigration) (?:status|sponsorship|type|holder)|(?:work|student|dependent|tourist|h-?1b|h-?4|l-?1|f-?1|o-?1|tn|e-?3) visa|sponsorship (?:required|needed)|(?:need|needs|require|requires|requiring|without|no) (?:\w+ ){0,2}sponsorship|h-?1b|stem opt|opt ead|green card|permanent resident|citizen(?:ship)?|ctc|lpa|salary|marital status|veteran|disability status|ethnicity|social security|(?:she|he|they)\/(?:her|him|them))\b/i,
  /\b\d{3}-\d{2}-\d{4}\b|\b\d{4} \d{4} \d{4}\b/, // SSN, Aadhaar
  /\b[A-Z]{5}\d{4}[A-Z]\b/, // PAN
];

/** Drops every line SENSITIVE_LINE matches. */
export function dropSensitiveLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !SENSITIVE_LINE.some((re) => re.test(line)))
    .join("\n");
}

/** Drops quoted history, signatures, contact details and the user's name; cuts to 550 tokens. */
export function redactEmailBody(body: string, user: { name: string }): string {
  let clean = body
    .split("\n")
    .filter((line) => !line.startsWith(">") && !/^On .+ wrote:/.test(line))
    .join("\n");
  const signatureAt = clean.indexOf("\n-- ");
  if (signatureAt !== -1) clean = clean.slice(0, signatureAt);
  clean = clean.split(user.name).join("[candidate]");
  return redactContact(clean).slice(0, 550 * 3);
}

/** HMAC-SHA256(USER_HASH_KEY, userId), hex, first 32 characters (10.3). */
export function userHash(userId: string): string {
  const key = env().USER_HASH_KEY;
  if (!key) throw new Error("USER_HASH_KEY is not set");
  return createHmac("sha256", key).update(userId).digest("hex").slice(0, 32);
}

/** bytea payload for llm_calls.user_hash: the first 16 bytes of the same HMAC. */
export function userHashBytes(userId: string): Buffer {
  return Buffer.from(userHash(userId), "hex").subarray(0, 16);
}
