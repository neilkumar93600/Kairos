import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATA_KEKS = `v1:${Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString("base64")}`;
});

const { capBody, encryptBody, previewOf, readBody, spamScore, bodyAad } = await import("../src/services/inbound");
const { decrypt, encrypt } = await import("../src/lib/crypto");

const ID = "0193f1e2-7c4a-7000-8000-00000000000a";

describe("the body and its preview", () => {
  it("capBody keeps at most 16,384 bytes and never half a character", () => {
    const cut = capBody("é\u{1F600}".repeat(20_000));
    expect(Buffer.byteLength(cut)).toBeLessThanOrEqual(16_384);
    expect(cut).not.toContain("�");
    expect(capBody("short")).toBe("short");
  });

  it("previewOf is 280 characters with whitespace collapsed, and never splits a surrogate pair", () => {
    expect(previewOf("a  b\n\n c")).toBe("a b c");
    expect([...previewOf("\u{1F600}".repeat(500))]).toHaveLength(280);
    expect(previewOf("\u{1F600}".repeat(500))).not.toContain("�");
    expect(previewOf("x".repeat(500))).toHaveLength(280);
  });

  it("encryptBody binds body and preview to their row and column, within the checks' sizes", () => {
    const body = capBody("\u{1F600}".repeat(20_000));
    const { textBodyEnc, previewEnc } = encryptBody(ID, body);
    expect(decrypt(textBodyEnc!, { table: "inbound_emails", id: ID, column: "text_body" }).toString("utf8")).toBe(body);
    expect(decrypt(previewEnc!, { table: "inbound_emails", id: ID, column: "preview" }).toString("utf8")).toBe(previewOf(body));
    expect(() => decrypt(textBodyEnc!, { table: "inbound_emails", id: ID, column: "preview" })).toThrow(/decryption failed/);
    expect(() => decrypt(textBodyEnc!, { table: "inbound_emails", id: "other", column: "text_body" })).toThrow(/decryption failed/);
    expect(textBodyEnc!.length).toBeLessThanOrEqual(16_448); // inbound_emails_body_size_ck
    expect(previewEnc!.length).toBeLessThanOrEqual(1_200); // inbound_emails_preview_size_ck
  });

  it("an empty body is an encrypted empty string, so the pair check holds", () => {
    const { textBodyEnc, previewEnc } = encryptBody(ID, "");
    expect(textBodyEnc).not.toBeNull();
    expect(previewEnc).not.toBeNull();
  });

  it("readBody prefers the ciphertext and falls back to the legacy plaintext", () => {
    const enc = encrypt("secret", bodyAad(ID));
    expect(readBody({ id: ID, textBodyEnc: enc, textBody: "stale" })).toBe("secret");
    expect(readBody({ id: ID, textBodyEnc: null, textBody: "legacy" })).toBe("legacy");
    expect(readBody({ id: ID, textBodyEnc: null, textBody: null })).toBe("");
  });
});

describe("spamScore", () => {
  const h = (...values: string[]) => values.map((Value) => ({ Name: "X-Spam-Score", Value }));

  it("reads the header whatever its case, and ignores others", () => {
    expect(spamScore([{ Name: "x-spam-SCORE", Value: "5.5" }, { Name: "X-Other", Value: "9" }])).toBe(5.5);
  });

  it("takes the highest: a sender cannot lower Postmark's score with a header of its own", () => {
    expect(spamScore(h("-100", "8.2"))).toBe(8.2);
    expect(spamScore(h("8.2", "-100"))).toBe(8.2);
  });

  it("is null when absent or unreadable", () => {
    expect(spamScore(undefined)).toBeNull();
    expect(spamScore([])).toBeNull();
    expect(spamScore(h("high"))).toBeNull();
  });
});
