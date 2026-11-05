import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearDkimKeyCache, keyFromRecord, parseGmailForwardingConfirmation, renderForwardingCode, verifiedDomains, type KeyLookup } from "../src/services/forwarding";

/**
 * The DKIM check on a Gmail forwarding confirmation (S-G1). There is no real Google sample until the owner supplies one
 * (owner-actions/WP-24.md), so this signs messages with its own small signer, written apart from the verifier, under a
 * key the lookup hands out only for the name the signature names.
 */
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const stranger = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SENDER = "forwarding-noreply@google.com";
const TO = "u-abc12345-deadbeef@replies.kairos.app";
const lookupAny: KeyLookup = async () => publicKey;
const lookup: KeyLookup = async (name) => (name === "s1._domainkey.google.com" ? publicKey : null);

beforeEach(clearDkimKeyCache);

const relaxedHeader = (name: string, value: string) => `${name.toLowerCase()}:${value.replace(/\r\n(?=[ \t])/g, "").replace(/[ \t]+/g, " ").trim()}`;
const relaxedBody = (body: string) => {
  const lines = body.split("\r\n").map((l) => l.replace(/[ \t]+/g, " ").replace(/ $/, ""));
  while (lines.length && lines.at(-1) === "") lines.pop();
  return lines.length ? `${lines.join("\r\n")}\r\n` : "";
};
const simpleBody = (body: string) => `${body.replace(/(\r\n)+$/, "")}\r\n`;

type Options = {
  d?: string; a?: string; h?: string[]; extraTags?: string; c?: string; key?: typeof privateKey;
  headers?: [string, string][]; body?: string; tamper?: (msg: string) => string;
};

/** A message with a DKIM-Signature, as Postmark's RawEmail holds it. */
function signedMail(o: Options = {}): string {
  const headers = o.headers ?? [["From", `Gmail Team <${SENDER}>`], ["To", TO], ["Subject", "(#123456789) Gmail Forwarding Confirmation"]];
  const body = o.body ?? "Confirmation code: 123456789\r\nhttps://mail-settings.google.com/mail/vf-abc\r\n";
  const c = o.c ?? "relaxed/relaxed";
  const [hc, bc] = c.split("/");
  const h = o.h ?? ["from", "to", "subject"];
  const bh = createHash("sha256").update(bc === "relaxed" ? relaxedBody(body) : simpleBody(body)).digest("base64");
  const open = `v=1; a=${o.a ?? "rsa-sha256"}; c=${c}; d=${o.d ?? "google.com"}; s=s1; h=${h.join(":")}; bh=${bh};${o.extraTags ?? ""} b=`;
  const signedText = (name: string, value: string) => (hc === "relaxed" ? relaxedHeader(name, value) : `${name}: ${value}`);
  const lines = h.flatMap((name) => {
    const found = headers.filter(([n]) => n.toLowerCase() === name).at(-1);
    return found ? [`${signedText(found[0], found[1])}\r\n`] : [];
  });
  const data = lines.join("") + signedText("DKIM-Signature", open);
  const b = sign("sha256", Buffer.from(data), o.key ?? privateKey).toString("base64");
  const msg = `DKIM-Signature: ${open}${b}\r\n${headers.map(([n, v]) => `${n}: ${v}`).join("\r\n")}\r\n\r\n${body}`;
  return o.tamper ? o.tamper(msg) : msg;
}

const confirmation = (rawEmail: string | undefined, over: Partial<{ from: string; subject: string; textBody: string; recipient: string }> = {}) =>
  parseGmailForwardingConfirmation(
    {
      from: `Gmail Team <${SENDER}>`,
      subject: "(#123456789) Gmail Forwarding Confirmation - Receive Mail from me@gmail.com",
      textBody: "me@gmail.com has requested to forward mail.\n\nConfirmation code: 123456789\n\nhttps://mail-settings.google.com/mail/vf-abc\n",
      rawEmail,
      recipient: TO,
      ...over,
    },
    lookup,
  );

describe("a genuine confirmation", () => {
  it.each([["relaxed/relaxed"], ["simple/simple"], ["relaxed/simple"], ["simple/relaxed"]])("verifies under %s and gives the code and link", async (c) => {
    expect(await confirmation(signedMail({ c }))).toEqual({ code: "123456789", confirmUrl: "https://mail-settings.google.com/mail/vf-abc" });
  });

  it("verifies through a folded signed header and a folded signature", async () => {
    const raw = signedMail({
      headers: [["From", `Gmail Team\r\n <${SENDER}>`], ["To", TO], ["Subject", "x"]],
      tamper: (m) => m.replace("; h=", ";\r\n\th="),
    });
    expect(await confirmation(raw)).toMatchObject({ code: "123456789" });
  });

  it("accepts a message whose lines Postmark passed with bare LF", async () => {
    expect(await confirmation(signedMail().replace(/\r\n/g, "\n"))).toMatchObject({ code: "123456789" });
  });

  it("accepts a message whose line endings Postmark mixed", async () => {
    const raw = signedMail();
    const split = raw.indexOf("\r\nTo:");
    expect(await confirmation(`${raw.slice(0, split)}\n${raw.slice(split + 2)}`)).toMatchObject({ code: "123456789" });
  });

  it("drops a link on another host and keeps the code", async () => {
    const out = await confirmation(signedMail(), { textBody: "Confirmation code: 123456789\nhttps://mail-settings.google.com.evil.example/vf\nhttps://evil.example/x" });
    expect(out).toEqual({ code: "123456789", confirmUrl: null });
  });

  it("drops an http link, and a link with credentials or a port on the right host", async () => {
    const textBody = "Confirmation code: 123456789\nhttp://mail-settings.google.com/a\nhttps://u:p@mail-settings.google.com/b\nhttps://mail-settings.google.com:8443/c";
    expect(await confirmation(signedMail(), { textBody })).toEqual({ code: "123456789", confirmUrl: null });
  });

  it("takes the code from the subject when the body has none", async () => {
    expect(await confirmation(signedMail(), { textBody: "no code here" })).toEqual({ code: "123456789", confirmUrl: null });
  });

  it("is ordinary mail when Google's sender wrote about something else, signature fine", async () => {
    expect(await confirmation(signedMail(), { subject: "Your Google account" })).toBeNull();
  });
});

describe("a spoofed confirmation shows no link", () => {
  it.each<[string, () => string | undefined]>([
    ["no raw message to verify (Postmark's raw content off)", () => undefined],
    ["no DKIM-Signature at all", () => signedMail().replace(/^DKIM-Signature:.*\r\n/, "")],
    ["a body changed after signing", () => signedMail({ tamper: (m) => m.replace("vf-abc", "vf-evil") })],
    ["a From changed after signing", () => signedMail({ tamper: (m) => m.replace("Gmail Team", "Gmail Tean") })],
    ["a signature by another key", () => signedMail({ key: stranger.privateKey })],
    ["a signature for the attacker's domain", () => signedMail({ d: "evil.example" })],
    ["a signature for a look-alike suffix", () => signedMail({ d: "google.com.evil.example" })],
    ["a signature for a subdomain of google.com", () => signedMail({ d: "mail.google.com" })],
    ["a signature for gmail.com, not the sender's domain", () => signedMail({ d: "gmail.com" })],
    ["a signature not covering From", () => signedMail({ h: ["to", "subject"] })],
    ["a signature not covering To", () => signedMail({ h: ["from", "subject"] })],
    ["a body-length tag, which lets a sender append text", () => signedMail({ extraTags: " l=10;" })],
    ["an expired signature", () => signedMail({ extraTags: " x=1000;" })],
    ["rsa-sha1", () => signedMail({ a: "rsa-sha1" })],
    ["a second From added above the signed one", () => signedMail({ tamper: (m) => `From: evil@evil.example\r\n${m}` })],
    ["a To holding the address as a prefix of another domain", () => signedMail({ headers: [["From", `Gmail Team <${SENDER}>`], ["To", `${TO}.attacker.example`], ["Subject", "x"]] })],
    ["an unreadable expiry", () => signedMail({ extraTags: " x=soon;" })],
    ["an unreadable signing time", () => signedMail({ extraTags: " t=soon;" })],
    ["a signing time from long ago", () => signedMail({ extraTags: " t=1000;" })],
    ["a signing time far ahead", () => signedMail({ extraTags: ` t=${Math.floor(Date.now() / 1000) + 30 * 86_400};` })],
    ["a genuine confirmation replayed to another address", () => signedMail({ headers: [["From", `Gmail Team <${SENDER}>`], ["To", "someone-else@replies.kairos.app"], ["Subject", "x"]] })],
    ["a From in the raw message from another sender", () => signedMail({ headers: [["From", "evil@evil.example"], ["To", TO], ["Subject", "x"]] })],
    ["garbage", () => "not a message"],
  ])("%s", async (_why, raw) => {
    expect(await confirmation(raw())).toBe("forged");
  });

  it("a selector with no key record", async () => {
    expect(await parseGmailForwardingConfirmation({ from: SENDER, subject: "Gmail Forwarding Confirmation", textBody: "", rawEmail: signedMail(), recipient: TO }, async () => null)).toBe("forged");
  });

  it("mail from any other sender is not looked at, whatever it says", async () => {
    let lookups = 0;
    const out = await parseGmailForwardingConfirmation(
      { from: "forwarding-noreply@g00gle.example", subject: "Gmail Forwarding Confirmation", textBody: "Confirmation code: 123456789", recipient: TO },
      async () => (lookups++, null),
    );
    expect(out).toBeNull();
    expect(lookups).toBe(0);
  });

  it("a mail cannot make one request run dozens of DNS lookups", async () => {
    let lookups = 0;
    const one = signedMail({ key: stranger.privateKey }).split("\r\n")[0]!;
    const raw = `${`${one}\r\n`.repeat(30)}${signedMail()}`;
    const out = await parseGmailForwardingConfirmation(
      { from: SENDER, subject: "Gmail Forwarding Confirmation", textBody: "", rawEmail: raw, recipient: TO },
      async () => (lookups++, publicKey),
    );
    expect(out).toBe("forged");
    expect(lookups).toBe(1);
  });
});

describe("verifiedDomains, the verdict on any mail", () => {
  const FROM = "jobs@acme.example";
  const signedBy = (d: string) => signedMail({ d, h: ["from", "subject"], headers: [["From", `Acme <${FROM}>`], ["To", "me@x.example"], ["Subject", "x"]] });
  const counting = () => {
    const names: string[] = [];
    const count: KeyLookup = async (name) => (names.push(name), publicKey);
    return { names, count };
  };

  it("names the domain of a valid signature, without needing To signed", async () => {
    expect(await verifiedDomains(signedBy("acme.example"), { fromAddress: FROM, accept: () => true }, lookupAny)).toEqual(["acme.example"]);
  });

  it("never looks up a domain that could not be accepted", async () => {
    const { names, count } = counting();
    expect(await verifiedDomains(signedBy("evil.example"), { fromAddress: FROM, accept: (d) => d === "acme.example" }, count)).toEqual([]);
    expect(names).toEqual([]);
  });

  it("refuses when the raw From is not the address Postmark reported, or there are two", async () => {
    const { names, count } = counting();
    expect(await verifiedDomains(signedBy("acme.example"), { fromAddress: "other@acme.example", accept: () => true }, count)).toEqual([]);
    expect(await verifiedDomains(`From: evil@evil.example\r\n${signedBy("acme.example")}`, { fromAddress: FROM, accept: () => true }, count)).toEqual([]);
    expect(names).toEqual([]);
  });

  it("does not look up when the body hash is already wrong", async () => {
    const { names, count } = counting();
    const raw = signedBy("acme.example").replace("vf-abc", "vf-evil");
    expect(await verifiedDomains(raw, { fromAddress: FROM, accept: () => true }, count)).toEqual([]);
    expect(names).toEqual([]);
  });

  it("keeps a key that verified for an hour, so a later mail costs no lookup; a key that did not verify is not kept", async () => {
    const { names, count } = counting();
    const good = { fromAddress: FROM, accept: () => true };
    expect(await verifiedDomains(signedMail({ d: "acme.example", key: stranger.privateKey, h: ["from"], headers: [["From", FROM]] }), good, count)).toEqual([]);
    expect(names).toHaveLength(1);
    expect(await verifiedDomains(signedBy("acme.example"), good, count)).toEqual(["acme.example"]);
    expect(names).toHaveLength(2);
    expect(await verifiedDomains(signedBy("acme.example"), good, count)).toEqual(["acme.example"]);
    expect(names).toHaveLength(2);
  });

  it("looks up one key a message, even with two acceptable signatures", async () => {
    const { names, count } = counting();
    const a = signedBy("acme.example").split("\r\n")[0]!;
    const raw = `${a}\r\n${signedBy("mail.acme.example")}`;
    await verifiedDomains(raw, { fromAddress: FROM, accept: () => true }, count);
    expect(names).toHaveLength(1);
  });

  it("is fast on a raw message of the largest size read", async () => {
    const started = Date.now();
    const raw = signedMail({ d: "acme.example", h: ["from"], headers: [["From", FROM]], body: `${"line of text\r\n".repeat(70_000)}` });
    expect(raw.length).toBeGreaterThan(900_000);
    expect(await verifiedDomains(raw, { fromAddress: FROM, accept: () => true }, lookupAny)).toEqual(["acme.example"]);
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});

describe("keyFromRecord", () => {
  const der = (k: typeof publicKey, type: "spki" | "pkcs1") => k.export({ type, format: "der" }).toString("base64");

  it("reads spki and pkcs1 keys", () => {
    expect(keyFromRecord(`v=DKIM1; k=rsa; p=${der(publicKey, "spki")}`)?.type).toBe("public");
    expect(keyFromRecord(`v=DKIM1; p=${der(publicKey, "pkcs1")}`)?.type).toBe("public");
  });

  it("refuses a revoked, short or non-RSA key", () => {
    expect(keyFromRecord("v=DKIM1; p=")).toBeNull();
    expect(keyFromRecord("v=DKIM1; k=ed25519; p=abcd")).toBeNull();
    const short = generateKeyPairSync("rsa", { modulusLength: 1024 }).publicKey;
    expect(keyFromRecord(`v=DKIM1; p=${der(short, "spki")}`)).toBeNull();
    const ed = generateKeyPairSync("ed25519").publicKey;
    expect(keyFromRecord(`v=DKIM1; p=${ed.export({ type: "spki", format: "der" }).toString("base64")}`)).toBeNull();
  });
});

describe("renderForwardingCode", () => {
  it("skips an entity id that names another user, without a query", async () => {
    await expect(renderForwardingCode("u2:gmail:1700000000", "u1")).resolves.toEqual({ skip: "bad_entity" });
    await expect(renderForwardingCode("nonsense", "u1")).resolves.toEqual({ skip: "bad_entity" });
  });
});
