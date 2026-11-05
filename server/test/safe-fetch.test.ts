import type { LookupAddress } from "node:dns";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  MiB,
  createSafeAgent,
  guardedLookup,
  isBlockedAddress,
  parseRetryAfter,
  safeAgent,
  safeFetchJson,
  SafeFetchError,
  type RawResponse,
  type Resolver,
  type Send,
} from "../src/services/safe-fetch";

/**
 * The SSRF suite for board fetches (tests-50, 06-infrastructure 7.4, CISO shouldFix safe fetch). The network block of
 * test/setup-network.ts refuses any real socket, so the transport is faked (`send`) and the connect-time check is
 * exercised through the agent's own lookup, which is what Node calls when the socket connects.
 */

const HOST = "boards-api.greenhouse.io";
const URL_OK = `https://${HOST}/v1/boards/acme/jobs`;
const base = { allowedHosts: [HOST], maxBytes: 2 * MiB };

function reply(status: number, body: string | Buffer = "", headers: Record<string, string> = {}): { send: Send; seen: { url?: URL; headers?: Record<string, string> } } {
  const seen: { url?: URL; headers?: Record<string, string> } = {};
  const send: Send = async (url, h) => {
    seen.url = url;
    seen.headers = h;
    return { status, headers: headers, body: Readable.from([typeof body === "string" ? Buffer.from(body) : body]) } satisfies RawResponse;
  };
  return { send, seen };
}

const code = (p: Promise<unknown>) => p.then(() => "resolved", (e: unknown) => (e instanceof SafeFetchError ? e.code : `other: ${String(e)}`));

/** A resolver that answers from a script, one answer per call, and counts calls. */
function scripted(...answers: string[][]): Resolver & { calls: number } {
  const r = ((_host, _opts, cb) => {
    const next = answers[Math.min(r.calls, answers.length - 1)]!;
    r.calls += 1;
    cb(null, next.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })) as LookupAddress[]);
  }) as Resolver & { calls: number };
  r.calls = 0;
  return r;
}

function lookupOnce(resolve: Resolver, all: boolean): Promise<{ err: unknown; result: unknown }> {
  return new Promise((done) => {
    guardedLookup(resolve)(HOST, { all } as never, ((err: unknown, address: unknown, family: unknown) =>
      done({ err, result: all ? address : { address, family } })) as never);
  });
}

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1", "127.255.255.254", "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "100.100.100.200", "100.127.255.255", "0.0.0.0", "192.0.0.170", "198.18.0.1", "224.0.0.1",
    "255.255.255.255", "::", "::1", "::ffff:10.0.0.1", "::ffff:127.0.0.1", "::ffff:a00:1", "::ffff:7f00:1",
    "::ffff:169.254.169.254", "::ffff:8.8.8.8", "fd12::1", "fd00:ec2::254", "fc00::1", "fe80::1", "fec0::1", "ff02::1",
    "64:ff9b::a00:1", "2002:a00:1::1", "2001:0:4136:e378::1", "2001:db8::1", "::127.0.0.1",
    "not-an-ip", "", "localhost",
  ])("refuses %s", (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "104.18.20.1", "172.32.0.1", "100.128.0.1", "192.169.0.1", "2606:4700::6810:84e5", "2a00:1450:4001::200e"])(
    "allows public %s",
    (ip) => expect(isBlockedAddress(ip)).toBe(false),
  );
});

describe("the connect-time lookup", () => {
  it("hands back exactly the addresses it checked (single and all forms)", async () => {
    const r = scripted(["104.18.20.1"]);
    expect(await lookupOnce(r, false)).toEqual({ err: null, result: { address: "104.18.20.1", family: 4 } });
    expect(await lookupOnce(r, true)).toEqual({ err: null, result: [{ address: "104.18.20.1", family: 4 }] });
  });

  it.each([["10.0.0.1"], ["127.0.0.1"], ["169.254.169.254"], ["fd12::1"], ["::ffff:10.0.0.1"], ["100.64.1.1"]])(
    "refuses a name that resolves to %s",
    async (ip) => {
      const { err } = await lookupOnce(scripted([ip]), false);
      expect(err).toBeInstanceOf(SafeFetchError);
      expect((err as SafeFetchError).code).toBe("ssrf_address");
    },
  );

  it("refuses the whole name when any one answer is private (a mixed A record set)", async () => {
    const { err } = await lookupOnce(scripted(["104.18.20.1", "10.0.0.1"]), true);
    expect((err as SafeFetchError).code).toBe("ssrf_address");
  });

  it("refuses an empty answer and passes a resolver error through", async () => {
    expect(((await lookupOnce(scripted([]), false)).err as SafeFetchError).code).toBe("ssrf_address");
    const failing: Resolver = (_h, _o, cb) => cb(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }), []);
    expect(((await lookupOnce(failing, false)).err as Error).message).toBe("ENOTFOUND");
  });

  // DNS rebinding: a resolver that answers public first and private second. Each connection resolves once, inside the
  // lookup, and connects to what it checked; there is no earlier resolution whose answer could differ from the connect's.
  it("defeats rebinding: one resolution per connect, and the second, private answer is refused", async () => {
    const r = scripted(["104.18.20.1"], ["10.0.0.1"]);
    const first = await lookupOnce(r, false);
    expect(first).toEqual({ err: null, result: { address: "104.18.20.1", family: 4 } });
    expect(r.calls).toBe(1);
    const second = await lookupOnce(r, false);
    expect((second.err as SafeFetchError).code).toBe("ssrf_address");
    expect(r.calls).toBe(2);
  });

  it("is the lookup of the agent every board request uses, so the check runs when the socket connects", async () => {
    const agent = createSafeAgent(scripted(["127.0.0.1"]));
    type Lookup = (h: string, o: object, cb: (e: unknown) => void) => void;
    const lookup = (agent as unknown as { options: { lookup: Lookup } }).options.lookup;
    expect(typeof lookup).toBe("function");
    const err = await new Promise<unknown>((done) => lookup(HOST, {}, done));
    expect((err as SafeFetchError).code).toBe("ssrf_address");
    // The module's own agent resolves through the system resolver; localhost is in every hosts file, no network needed.
    const real = (safeAgent() as unknown as { options: { lookup: Lookup } }).options.lookup;
    expect(((await new Promise<unknown>((done) => real("localhost", { all: true }, done))) as SafeFetchError).code).toBe("ssrf_address");
    expect((safeAgent() as unknown as { maxSockets: number }).maxSockets).toBe(4);
  });
});

describe("safeFetchJson", () => {
  it("refuses http, a port, credentials and junk before any request", async () => {
    const { send, seen } = reply(200, "{}");
    for (const bad of [`http://${HOST}/x`, `https://${HOST}:8443/x`, `https://u:p@${HOST}/x`, "not a url", `ftp://${HOST}/x`]) {
      expect(await code(safeFetchJson(bad, { ...base, send }))).toBe("ssrf_scheme");
    }
    expect(seen.url).toBeUndefined();
  });

  it("refuses a host not on the exact list, a look-alike, and a literal IP even when listed", async () => {
    const { send, seen } = reply(200, "{}");
    for (const bad of [
      "https://evil.example/x",
      `https://${HOST}.evil.example/x`,
      `https://x${HOST}/x`,
      "https://api.lever.co/v0/postings/x",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/x",
      "https://2130706433/x", // 127.0.0.1 as one integer: URL normalizes it to a dotted literal
      "https://0x7f.1/x",
    ]) {
      expect(await code(safeFetchJson(bad, { ...base, send }))).toBe("ssrf_host");
    }
    expect(await code(safeFetchJson("https://127.0.0.1/x", { allowedHosts: ["127.0.0.1"], maxBytes: MiB, send }))).toBe("ssrf_host");
    expect(seen.url).toBeUndefined();
  });

  it("never follows a redirect, wherever it points", async () => {
    for (const status of [301, 302, 303, 307, 308]) {
      const { send } = reply(status, "", { location: "http://169.254.169.254/latest/meta-data" });
      expect(await code(safeFetchJson(URL_OK, { ...base, send }))).toBe("ssrf_redirect");
    }
  });

  it("returns the parsed body and the ETag, and sends an honest user agent and no cookies", async () => {
    const { send, seen } = reply(200, JSON.stringify({ jobs: [1] }), { etag: 'W/"abc"' });
    expect(await safeFetchJson(URL_OK, { ...base, send })).toEqual({ status: 200, body: { jobs: [1] }, etag: 'W/"abc"' });
    expect(seen.headers).toMatchObject({ "user-agent": expect.stringMatching(/^KairosBot\//), accept: "application/json" });
    expect(seen.headers).not.toHaveProperty("cookie");
    expect(seen.headers).not.toHaveProperty("if-none-match");
  });

  it("sends If-None-Match and reports a 304 and a 404 as results", async () => {
    const { send, seen } = reply(304);
    expect(await safeFetchJson(URL_OK, { ...base, etag: 'W/"abc"', send })).toEqual({ status: 304 });
    expect(seen.headers?.["if-none-match"]).toBe('W/"abc"');
    expect(await safeFetchJson(URL_OK, { ...base, send: reply(404, "nope").send })).toEqual({ status: 404 });
  });

  it("caps the streamed body: a declared length, an undeclared stream and a gzip bomb all stop at maxBytes", async () => {
    const big = Buffer.alloc(3 * MiB, 0x20);
    expect(await code(safeFetchJson(URL_OK, { ...base, send: reply(200, big, { "content-length": String(big.length) }).send }))).toBe("response_too_large");
    expect(await code(safeFetchJson(URL_OK, { ...base, send: reply(200, big).send }))).toBe("response_too_large");
    const bomb = gzipSync(Buffer.alloc(64 * MiB, 0x20)); // about 64 KB on the wire
    expect(bomb.length).toBeLessThan(MiB);
    expect(await code(safeFetchJson(URL_OK, { ...base, send: reply(200, bomb, { "content-encoding": "gzip" }).send }))).toBe("response_too_large");
    const fine = gzipSync(Buffer.from(JSON.stringify({ ok: true })));
    expect(await safeFetchJson(URL_OK, { ...base, send: reply(200, fine, { "content-encoding": "gzip" }).send })).toMatchObject({ body: { ok: true } });
  });

  it("refuses an unknown content encoding and a body that is not JSON", async () => {
    expect(await code(safeFetchJson(URL_OK, { ...base, send: reply(200, "{}", { "content-encoding": "zstd" }).send }))).toBe("bad_payload");
    expect(await code(safeFetchJson(URL_OK, { ...base, send: reply(200, "<html>").send }))).toBe("bad_payload");
  });

  it("reports 429 and 403 with Retry-After, and other statuses as http_error", async () => {
    const throttled = await safeFetchJson(URL_OK, { ...base, send: reply(429, "", { "retry-after": "120" }).send }).catch((e: SafeFetchError) => e);
    expect(throttled).toMatchObject({ code: "throttled", status: 429, retryAfterMs: 120_000 });
    const forbidden = await safeFetchJson(URL_OK, { ...base, send: reply(403).send }).catch((e: SafeFetchError) => e);
    expect(forbidden).toMatchObject({ code: "forbidden", status: 403, retryAfterMs: undefined });
    expect(await safeFetchJson(URL_OK, { ...base, send: reply(503).send }).catch((e: SafeFetchError) => e)).toMatchObject({ code: "http_error", status: 503 });
  });

  it("times out a body that never ends", async () => {
    const send: Send = async () => ({ status: 200, headers: {}, body: new Readable({ read() {} }) });
    expect(await code(safeFetchJson(URL_OK, { ...base, timeoutMs: 50, send }))).toBe("timeout");
  });

  it("keeps the URL out of every error message", async () => {
    const err = await safeFetchJson("https://evil.example/secret-token", { ...base, send: reply(200).send }).catch((e: Error) => e);
    expect((err as Error).message).not.toContain("secret-token");
  });
});

describe("parseRetryAfter", () => {
  it("reads seconds and HTTP dates", () => {
    expect(parseRetryAfter("30")).toBe(30_000);
    expect(parseRetryAfter(new Date(1_000_000 + 90_000).toUTCString(), 1_000_000)).toBeGreaterThanOrEqual(89_000);
    expect(parseRetryAfter("soon")).toBeUndefined();
    expect(parseRetryAfter(undefined)).toBeUndefined();
  });
});
