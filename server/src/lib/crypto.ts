import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

/**
 * Application-layer encryption for personal content that is never searched (02-database 3.3, 06-infrastructure 7.7).
 * Runbook, emergency kit and rotation: docs/runbook/keys.md.
 *
 * DATA_KEKS (api and worker only, never the applier): comma-separated `v<n>:<base64 of 32 random bytes>`, n from 1 to
 * 255, each version and key used once. The first entry encrypts; every entry decrypts. Rotation prepends a new version.
 *
 * Envelope, for a bytea column: format 0x01 (1 byte) || key version (1) || iv (12) || ciphertext || GCM tag (16), so at
 * least 30 bytes. A text column stores its base64; decrypt takes either form.
 * AAD is `<table>:<row id>:<column>`, so a ciphertext copied to another row, column or table does not decrypt.
 *
 * ponytail: random 96-bit ivs under one key directly, no per-row data key. NIST SP 800-38D caps that at 2^32
 * encryptions per key version; yearly rotation keeps Kairos orders of magnitude below. Wrap per-row keys if a single
 * version ever approaches 10^8 writes.
 */

const FORMAT = 0x01;
const HEADER = 2 + 12;
const TAG = 16;
const ENTRY = /^v([1-9]\d{0,2}):([A-Za-z0-9+/]{43}=)$/;

export type Keyring = { readonly current: number; readonly byVersion: ReadonlyMap<number, Buffer> };
/** The row a value belongs to. Table and column are identifiers without ':'; the id is the row's primary key. */
export type Aad = { table: string; id: string; column: string };

/** Parses DATA_KEKS. Messages name the entry by position and never echo it. */
export function parseKeks(raw: string): Keyring {
  const byVersion = new Map<number, Buffer>();
  for (const [i, entry] of raw.split(",").entries()) {
    const at = `entry ${i + 1}`;
    const m = entry.trim().match(ENTRY);
    if (!m) throw new Error(`${at} is not v<version>:<base64 of 32 bytes>`);
    const version = Number(m[1]);
    const key = Buffer.from(m[2]!, "base64");
    if (version > 255) throw new Error(`${at}: the version must be 1 to 255`);
    if (byVersion.has(version)) throw new Error(`${at} repeats a version`);
    if ([...byVersion.values()].some((k) => k.equals(key))) throw new Error(`${at} repeats the key of another version`);
    // A random 32-byte key has about 30 distinct byte values; fewer than 16 is a copied placeholder.
    if (new Set(key).size < 16) throw new Error(`${at} is a placeholder, not 32 random bytes`);
    byVersion.set(version, key);
  }
  return { current: byVersion.keys().next().value!, byVersion };
}

/** The process's key ring from env (parsed and checked at boot). Throws when DATA_KEKS is not set. */
export function dataKeys(): Keyring {
  const keys = env().DATA_KEKS;
  if (!keys) throw new Error("DATA_KEKS is not set");
  return keys;
}

function aadOf({ table, id, column }: Aad): Buffer {
  if (!table || !id || !column || table.includes(":") || column.includes(":")) {
    throw new Error("AAD needs a table, a row id and a column, and table and column cannot contain ':'");
  }
  return Buffer.from(`${table}:${id}:${column}`, "utf8");
}

function asBuffer(envelope: Uint8Array | string): Buffer {
  return typeof envelope === "string" ? Buffer.from(envelope, "base64") : Buffer.from(envelope.buffer, envelope.byteOffset, envelope.byteLength);
}

function keyVersionOf(envelope: Buffer): number {
  if (envelope.length < HEADER + TAG || envelope[0] !== FORMAT) throw new Error("ciphertext is not a Kairos envelope (format 1)");
  return envelope[1]!;
}

/** Encrypts under the current key with a fresh random iv. Store the Buffer in bytea, or its base64 in text. */
export function encrypt(plaintext: string | Uint8Array, aad: Aad, keys: Keyring = dataKeys()): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys.byVersion.get(keys.current)!, iv, { authTagLength: TAG });
  cipher.setAAD(aadOf(aad));
  const data = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([Buffer.from([FORMAT, keys.current]), iv, ciphertext, cipher.getAuthTag()]);
}

/** Decrypts and authenticates. Throws, without any plaintext or key, on a wrong key, row, column or altered byte. */
export function decrypt(envelope: Uint8Array | string, aad: Aad, keys: Keyring = dataKeys()): Buffer {
  const buf = asBuffer(envelope);
  const version = keyVersionOf(buf);
  const key = keys.byVersion.get(version);
  if (!key) throw new Error(`ciphertext is under key version ${version}, which DATA_KEKS does not hold`);
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(2, HEADER), { authTagLength: TAG });
  decipher.setAAD(aadOf(aad));
  decipher.setAuthTag(buf.subarray(buf.length - TAG));
  try {
    // Nothing is returned until final() has checked the tag.
    return Buffer.concat([decipher.update(buf.subarray(HEADER, buf.length - TAG)), decipher.final()]);
  } catch {
    throw new Error("decryption failed: wrong key, wrong row or column, or altered ciphertext");
  }
}

/**
 * Rotation report: true when the envelope is under an older key version. Reads the header only. The same test in SQL,
 * without loading rows: `get_byte(col, 1) <> <current version>`.
 */
export function needsRotation(envelope: Uint8Array | string, keys: Keyring = dataKeys()): boolean {
  return keyVersionOf(asBuffer(envelope)) !== keys.current;
}

/** Re-encrypts a value under the current key; null when it already is, so a backfill writes only rows that changed. */
export function rotate(envelope: Uint8Array | string, aad: Aad, keys: Keyring = dataKeys()): Buffer | null {
  return needsRotation(envelope, keys) ? encrypt(decrypt(envelope, aad, keys), aad, keys) : null;
}
