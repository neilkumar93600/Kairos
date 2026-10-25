import { createHmac } from "node:crypto";
import { env } from "../lib/env";

/**
 * PII redaction (03-agent-runtime.md 10.2). Contact details and identity never reach a model; a
 * unit test seeds every pattern and asserts nothing survives.
 */

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE = /\+?\d[\d ().-]{7,}\d/g;
const URL = /\bhttps?:\/\/\S+/gi;
const ADDRESS = /\b\d{1,5}\s+[\w.]+(?:\s+[\w.]+)*\s+(?:street|st\.?|avenue|ave\.?|road|rd\.?|lane|ln\.?|drive|dr\.?|court|ct\.?|boulevard|blvd\.?|way|place|pl\.?|sector|nagar|road)\b/gi;

/** Replaces emails, phone numbers, URLs and street-address patterns with [email], [phone], [link], [address]. */
export function redactContact(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(URL, "[link]")
    .replace(ADDRESS, "[address]")
    .replace(PHONE, "[phone]");
}

/**
 * Removes the resume's contact header: exact matches of the profile's name, email, phone, city line
 * and link hosts, then redactContact on the rest. Used before resume-parser.
 */
export function redactResumeHeader(
  text: string,
  profile: { name: string; email: string; phone?: string; links: string[] },
): string {
  let clean = text;
  const literals = [profile.name, profile.email, profile.phone, ...profile.links]
    .filter((v): v is string => Boolean(v))
    .sort((a, b) => b.length - a.length);
  for (const literal of literals) clean = clean.split(literal).join("[contact]");
  // The city line: a line that became mostly redactions plus a place name.
  return redactContact(clean)
    .split("\n")
    .filter((line) => !/^\s*\[contact\](\s*\|)?\s*$/.test(line))
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
