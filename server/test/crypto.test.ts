import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, needsRotation, parseKeks, rotate } from "../src/lib/crypto";
import { parseEnv } from "../src/lib/env";

// WP-18 (database-33, v06; 02-database 3.3): AES-256-GCM under versioned DATA_KEKS, AAD <table>:<row id>:<column>.

const k1 = randomBytes(32).toString("base64");
const k2 = randomBytes(32).toString("base64");
const v1 = parseKeks(`v1:${k1}`);
const v2v1 = parseKeks(`v2:${k2},v1:${k1}`);
const v2 = parseKeks(`v2:${k2}`);

const row = { table: "resume_profiles", id: "0193f1e2-7c4a-7000-8000-000000000001", column: "source_text" };
const secret = "Jane Doe, 12 Elm St, visa: H-1B, expected salary 180000";

/** Every message an operation throws, so a test can assert what never appears in one. */
function messageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return String(err) + String((err as Error).stack);
  }
  throw new Error("expected a throw");
}

function flip(envelope: Buffer, at: number): Buffer {
  const copy = Buffer.from(envelope);
  copy[at]! ^= 0x01;
  return copy;
}

describe("encrypt and decrypt", () => {
  it("round-trips text and bytes", () => {
    expect(decrypt(encrypt(secret, row, v1), row, v1).toString("utf8")).toBe(secret);
    const bytes = randomBytes(1000);
    expect(decrypt(encrypt(bytes, row, v1), row, v1).equals(bytes)).toBe(true);
    expect(decrypt(encrypt("", row, v1), row, v1).length).toBe(0);
  });

  it("round-trips through base64, for a text column", () => {
    const stored = encrypt(secret, row, v1).toString("base64");
    expect(decrypt(stored, row, v1).toString("utf8")).toBe(secret);
  });

  it("writes format 1, the current key version, a 12-byte iv and a 16-byte tag around the ciphertext", () => {
    const env = encrypt(secret, row, v2v1);
    expect(env[0]).toBe(1);
    expect(env[1]).toBe(2);
    expect(env.length).toBe(2 + 12 + Buffer.byteLength(secret) + 16);
    expect(env.includes(Buffer.from(secret))).toBe(false);
  });

  it("gives two encryptions of the same plaintext different ivs and ciphertexts", () => {
    const a = encrypt(secret, row, v1);
    const b = encrypt(secret, row, v1);
    expect(a.equals(b)).toBe(false);
    expect(a.subarray(2, 14).equals(b.subarray(2, 14))).toBe(false);
  });

  it("refuses a ciphertext copied to another row, column or table", () => {
    const env = encrypt(secret, row, v1);
    expect(() => decrypt(env, { ...row, id: "0193f1e2-7c4a-7000-8000-000000000002" }, v1)).toThrow(/decryption failed/);
    expect(() => decrypt(env, { ...row, column: "preview" }, v1)).toThrow(/decryption failed/);
    expect(() => decrypt(env, { ...row, table: "inbound_emails" }, v1)).toThrow(/decryption failed/);
  });

  it("refuses a tampered iv, ciphertext or tag", () => {
    const env = encrypt(secret, row, v1);
    expect(() => decrypt(flip(env, 2), row, v1)).toThrow(/decryption failed/); // iv
    expect(() => decrypt(flip(env, 20), row, v1)).toThrow(/decryption failed/); // ciphertext
    expect(() => decrypt(flip(env, env.length - 1), row, v1)).toThrow(/decryption failed/); // tag
    expect(() => decrypt(Buffer.concat([env, Buffer.from([0])]), row, v1)).toThrow(/decryption failed/);
  });

  it("refuses a value that is not an envelope: wrong format byte, too short, or plaintext", () => {
    const env = encrypt(secret, row, v1);
    expect(() => decrypt(flip(env, 0), row, v1)).toThrow(/not a Kairos envelope/);
    expect(() => decrypt(env.subarray(0, 29), row, v1)).toThrow(/not a Kairos envelope/);
    expect(() => decrypt(Buffer.from(secret), row, v1)).toThrow(/not a Kairos envelope/);
  });

  it("names an unknown key version clearly", () => {
    const env = encrypt(secret, row, v2v1);
    expect(() => decrypt(env, row, v1)).toThrow("ciphertext is under key version 2, which DATA_KEKS does not hold");
  });

  it("refuses an AAD that could be ambiguous or empty", () => {
    expect(() => encrypt(secret, { ...row, table: "a:b" }, v1)).toThrow(/AAD/);
    expect(() => encrypt(secret, { ...row, column: "" }, v1)).toThrow(/AAD/);
    expect(() => encrypt(secret, { ...row, id: "" }, v1)).toThrow(/AAD/);
    // A ':' in the id is fine: table and column cannot hold one, so the string still parses one way.
    const id = "user:42";
    expect(decrypt(encrypt(secret, { ...row, id }, v1), { ...row, id }, v1).toString()).toBe(secret);
  });

  it("fails closed when DATA_KEKS is not set", () => {
    expect(() => encrypt(secret, row)).toThrow("DATA_KEKS is not set");
  });
});

describe("rotation", () => {
  it("decrypts a value under the old version after a new key is prepended, and encrypts new values under the new one", () => {
    const old = encrypt(secret, row, v1);
    expect(decrypt(old, row, v2v1).toString()).toBe(secret);
    expect(encrypt(secret, row, v2v1)[1]).toBe(2);
  });

  it("reports and re-encrypts a row under an old version, and leaves a current row alone", () => {
    const old = encrypt(secret, row, v1);
    expect(needsRotation(old, v1)).toBe(false);
    expect(needsRotation(old, v2v1)).toBe(true);

    const rotated = rotate(old, row, v2v1)!;
    expect(rotated[1]).toBe(2);
    expect(needsRotation(rotated, v2v1)).toBe(false);
    expect(rotate(rotated, row, v2v1)).toBeNull();

    // Once v1 is retired the rotated row still opens and the old one names the missing version.
    expect(decrypt(rotated, row, v2).toString()).toBe(secret);
    expect(() => decrypt(old, row, v2)).toThrow(/key version 1/);
  });

  it("does not re-encrypt a row whose AAD does not match", () => {
    expect(() => rotate(encrypt(secret, row, v1), { ...row, id: "other" }, v2v1)).toThrow(/decryption failed/);
  });
});

describe("parseKeks", () => {
  it("takes the first entry as current and holds every version", () => {
    expect(v2v1.current).toBe(2);
    expect([...v2v1.byVersion.keys()]).toEqual([2, 1]);
    // A new key can be staged for decryption only (rotation step 1) before it becomes current.
    expect(parseKeks(`v1:${k1}, v2:${k2}`).current).toBe(1);
  });

  it.each([
    ["an empty value", ""],
    ["a missing version", k1],
    ["version 0", `v0:${k1}`],
    ["version 256", `v256:${k1}`],
    ["a short key", `v1:${randomBytes(16).toString("base64")}`],
    ["a long key", `v1:${randomBytes(48).toString("base64")}`],
    ["base64url", `v1:${randomBytes(32).toString("base64url")}`],
    ["a trailing comma", `v1:${k1},`],
    ["a repeated version", `v1:${k1},v1:${k2}`],
    ["the same key under two versions", `v2:${k1},v1:${k1}`],
    ["a placeholder key", `v1:${Buffer.alloc(32).toString("base64")}`],
  ])("refuses %s", (_, raw) => {
    expect(() => parseKeks(raw)).toThrow();
  });
});

describe("DATA_KEKS at boot", () => {
  const prod = {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://u:p@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    BETTER_AUTH_SECRET: "x".repeat(32),
    BETTER_AUTH_URL: "https://kairos.app",
    WEB_ORIGIN: "https://kairos.app",
    INBOUND_WEBHOOK_SECRET: "y".repeat(16),
    POSTMARK_SERVER_TOKEN: "pm-token",
    USER_HASH_KEY: Buffer.alloc(32, 9).toString("base64"),
  };

  it("parses a valid list into the key ring", () => {
    expect(parseEnv({ ...prod, DATA_KEKS: `v2:${k2},v1:${k1}` }).DATA_KEKS?.current).toBe(2);
  });

  it("refuses to boot with a malformed or short key, naming the variable", () => {
    expect(() => parseEnv({ ...prod, DATA_KEKS: `v1:${randomBytes(31).toString("base64")}` })).toThrow(/DATA_KEKS: entry 1/);
    expect(() => parseEnv({ ...prod, DATA_KEKS: "v1:not-a-key" })).toThrow(/DATA_KEKS: entry 1/);
  });

  // Required in production since WP-17 (resume_imports.source_text_enc is written on the request path).
  it("refuses production without it, and boots without it elsewhere (encrypt then fails closed, above)", () => {
    expect(() => parseEnv(prod)).toThrow(/DATA_KEKS: required in production/);
    expect(parseEnv({ ...prod, NODE_ENV: "development" }).DATA_KEKS).toBeUndefined();
  });
});

describe("error messages", () => {
  it("never carry the plaintext or any key material", () => {
    const env = encrypt(secret, row, v2v1);
    const short = randomBytes(31).toString("base64");
    const messages = [
      messageOf(() => decrypt(env, { ...row, id: "other" }, v2v1)),
      messageOf(() => decrypt(flip(env, 20), row, v2v1)),
      messageOf(() => decrypt(env, row, v1)),
      messageOf(() => decrypt(Buffer.from(secret), row, v2v1)),
      messageOf(() => rotate(encrypt(secret, row, v1), { ...row, column: "other" }, v2v1)),
      messageOf(() => parseKeks(`v2:${k2},v1:${short}`)),
      messageOf(() => parseKeks(`v2:${k2},v2:${k1}`)),
      messageOf(() => parseEnv({ DATA_KEKS: `v1:${k1},v1:${k2}` })),
    ].join("\n");
    for (const needle of [secret, "Jane Doe", k1, k2, short, Buffer.from(k1, "base64").toString("hex")]) {
      expect(messages).not.toContain(needle);
    }
  });
});
