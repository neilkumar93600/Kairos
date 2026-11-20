import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATA_KEKS = `v1:${Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1)).toString("base64")}`;
});

const { capBody, encryptBody, postmarkInboundSchema, previewAad, previewOf, RAW_EMAIL_MAX, readBody, spamScore, storeInboundEmail, bodyAad } = await import("../src/services/inbound");
const { readPreview } = await import("../src/routes/inbox");
const { logger } = await import("../src/lib/logger");
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

describe("postmarkInboundSchema never refuses real mail for its length", () => {
  const base = { MessageID: "m1", From: "hr@acme.com", To: "u@replies.test" };
  const parse = (over: object) => postmarkInboundSchema.parse({ ...base, ...over });

  it("takes a 5 KB header and keeps only the spam score", () => {
    const out = parse({ Headers: [{ Name: "References", Value: "x".repeat(5_000) }, { Name: "X-Spam-Score", Value: "2.5" }] });
    expect(out.Headers).toEqual([{ Name: "X-Spam-Score", Value: "2.5" }]);
  });

  it("takes thousands of headers, and malformed ones it does not read", () => {
    const headers = [...Array.from({ length: 3_000 }, () => ({ Name: "Received", Value: "y" })), null, { Name: 5, Value: 6 }];
    expect(parse({ Headers: headers }).Headers).toEqual([]);
  });

  it("cuts a 400-character From from the front, so the address survives", () => {
    const out = parse({ From: `${"n".repeat(400)} <jobs@acme.com>` });
    expect(out.From).toHaveLength(320);
    expect(out.From.endsWith("<jobs@acme.com>")).toBe(true);
  });

  it("cuts To, Subject, a recipient and an attachment's name", () => {
    const out = parse({ To: "t".repeat(5_000), Subject: "s".repeat(5_000), OriginalRecipient: "r".repeat(5_000), Attachments: [{ Name: "a".repeat(5_000), ContentType: "c".repeat(5_000), ContentLength: 1 }] });
    expect(out.To).toHaveLength(2_000);
    expect(out.Subject).toHaveLength(500);
    expect(out.OriginalRecipient).toHaveLength(320);
    expect(out.Attachments![0]).toMatchObject({ Name: "a".repeat(200), ContentType: "c".repeat(200) });
  });

  it("treats a raw message over the cap as absent, and keeps one at the cap", () => {
    expect(parse({ RawEmail: "x".repeat(RAW_EMAIL_MAX + 1) }).RawEmail).toBeUndefined();
    expect(parse({ RawEmail: "x".repeat(RAW_EMAIL_MAX) }).RawEmail).toHaveLength(RAW_EMAIL_MAX);
  });

  it.each([
    ["no message id", { MessageID: undefined }],
    ["no sender", { From: undefined }],
    ["no To", { To: undefined }],
    ["Headers that are not a list", { Headers: "x" }],
    ["a kept header with no value", { Headers: [{ Name: "X-Spam-Score" }] }],
    ["an attachment size that is not a number", { Attachments: [{ ContentLength: "big" }] }],
  ])("still refuses %s", (_why, over) => {
    expect(postmarkInboundSchema.safeParse({ ...base, ...over }).success).toBe(false);
  });
});

describe("storeInboundEmail", () => {
  it("drops Kairos's own mail before touching the database: a forwarded digest is not a reply", async () => {
    const mail = postmarkInboundSchema.parse({ MessageID: "m1", From: "Kairos <hello@kairos.app>", To: "u@replies.test", Subject: "3 new matches", TextBody: "An interview at Acme" });
    await expect(storeInboundEmail(mail)).resolves.toEqual({ stored: false });
  });
});

describe("readPreview", () => {
  const valid = () => encrypt("hello", previewAad(ID));

  it("reads the preview, or the legacy text of an older row", () => {
    expect(readPreview(ID, valid(), null)).toBe("hello");
    expect(readPreview(ID, null, "legacy")).toBe("legacy");
    expect(readPreview(ID, null, null)).toBe("");
  });

  it("a tampered envelope or one from another row shows empty, and logs the row id alone", () => {
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined as never);
    const tampered = valid();
    tampered[tampered.length - 1]! ^= 0xff;
    expect(readPreview(ID, tampered, null)).toBe("");
    expect(readPreview("other-row", valid(), null)).toBe("");
    expect(error).toHaveBeenCalledTimes(2);
    expect(error.mock.calls[0]).toEqual([{ inboundEmailId: ID }, expect.any(String)]);
    error.mockRestore();
  });
});
