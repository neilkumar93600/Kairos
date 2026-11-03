import { Readable } from "node:stream";
import { text } from "node:stream/consumers";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../src/lib/errors";
import { parseEnv } from "../src/lib/env";
import { createStorage, parseKey, PRESIGN_MAX_SEC, storageConfig, userKey, type BucketConfig, type StorageConfig } from "../src/lib/storage";

/** WP-14: private R2 buckets, per-user key prefixes, a token per bucket, presigned GETs of 5 minutes at most. */

const bucket = (name: string): BucketConfig => ({ name, accessKeyId: `id-${name}`, secretAccessKey: `secret-${name}` });
const config: StorageConfig = {
  endpoint: "https://acct.r2.cloudflarestorage.com",
  buckets: { uploads: bucket("kairos-uploads"), renders: bucket("kairos-renders"), snapshots: bucket("kairos-snapshots"), backups: bucket("kairos-backups") },
};

/** An in-memory R2 behind S3Client#send; it never opens a socket. Lists at most `pageSize` keys, like R2's 1,000. */
function fakeR2(pageSize = 1000) {
  const objects = new Map<string, string>(); // "<bucket name>|<object key>"
  const calls: { bucket: string; command: string; accessKeyId: string }[] = [];
  const makeClient = vi.fn((_endpoint: string, b: BucketConfig) => {
    const send = async (cmd: { input: Record<string, unknown> }) => {
      const input = cmd.input as { Bucket: string; Key?: string; Prefix?: string; Body?: string; Delete?: { Objects: { Key: string }[] } };
      // The client is bound to its own bucket's token: a request for another bucket is R2's AccessDenied.
      if (input.Bucket !== b.name) throw Object.assign(new Error("Access Denied"), { name: "AccessDenied" });
      calls.push({ bucket: input.Bucket, command: cmd.constructor.name, accessKeyId: b.accessKeyId });
      const id = `${input.Bucket}|${input.Key}`;
      if (cmd instanceof PutObjectCommand) return void objects.set(id, String(input.Body));
      if (cmd instanceof GetObjectCommand) {
        if (!objects.has(id)) throw Object.assign(new Error("The specified key does not exist."), { name: "NoSuchKey" });
        const body = objects.get(id)!;
        return { Body: Readable.from([Buffer.from(body)]), ContentLength: body.length };
      }
      if (cmd instanceof ListObjectsV2Command) {
        const keys = [...objects.keys()].filter((k) => k.startsWith(`${input.Bucket}|${input.Prefix}`)).map((k) => k.split("|")[1]!);
        return { Contents: keys.slice(0, pageSize).map((Key) => ({ Key })), IsTruncated: keys.length > pageSize };
      }
      if (cmd instanceof DeleteObjectsCommand) {
        for (const { Key } of input.Delete!.Objects) objects.delete(`${input.Bucket}|${Key}`);
        return { Errors: [] };
      }
      throw new Error(`fake R2: unexpected ${cmd.constructor.name}`);
    };
    return { send } as unknown as S3Client;
  });
  return { objects, calls, makeClient, storage: createStorage(config, makeClient) };
}

describe("keys", () => {
  it("builds <bucket>/<userId>/<name> and parses it back", () => {
    expect(userKey("snapshots", "u_A1-b", "3f9a.pdf")).toBe("snapshots/u_A1-b/3f9a.pdf");
    expect(parseKey("uploads/u1/resume.docx")).toEqual({ bucket: "uploads", owner: "u1", name: "resume.docx" });
    expect(parseKey("backups/journal/2026-11-03T10-00.ndjson.age")).toEqual({ bucket: "backups", owner: "journal", name: "2026-11-03T10-00.ndjson.age" });
  });

  it.each([
    ["a traversal segment", "uploads/../u1/x.pdf"],
    ["a traversal in the name", "uploads/u1/..pdf"],
    ["a leading slash", "/uploads/u1/x.pdf"],
    ["an empty segment", "uploads//x.pdf"],
    ["a nested path", "uploads/u1/sub/x.pdf"],
    ["an unknown bucket", "failures/u1/x.png"],
    ["a backslash", "uploads/u1/x\\..\\y.pdf"],
    ["a percent escape", "uploads/u1/x%2F.pdf"],
    ["a non-ASCII name", "uploads/u1/résumé.pdf"],
    ["a hidden file", "uploads/u1/.env"],
    ["a name over 120 characters", `uploads/u1/${"a".repeat(121)}`],
    ["a user id over 64 characters", `uploads/${"u".repeat(65)}/x.pdf`],
  ])("refuses %s", (_label, key) => {
    expect(parseKey(key)).toBeNull();
  });

  it("refuses to build a key outside the user's own prefix", () => {
    expect(() => userKey("uploads", "u1/../u2", "x.pdf")).toThrow(/unsafe storage key/);
    expect(() => userKey("uploads", "u1", "../u2/x.pdf")).toThrow(/unsafe storage key/);
    expect(() => userKey("uploads", "", "x.pdf")).toThrow(/unsafe storage key/);
  });
});

describe("createStorage", () => {
  it("puts and gets through the bucket's own client, with the bucket segment dropped from the object key", async () => {
    const r2 = fakeR2();
    const key = userKey("snapshots", "u1", "abc.pdf");
    await r2.storage.put(key, "%PDF-1.7", "application/pdf");
    expect(r2.objects.get("kairos-snapshots|u1/abc.pdf")).toBe("%PDF-1.7");
    const file = await r2.storage.get(key);
    expect(await text(file!.body)).toBe("%PDF-1.7");
    expect(file!.contentLength).toBe(8);
    expect(r2.calls.every((c) => c.accessKeyId === "id-kairos-snapshots")).toBe(true);
    // One client per bucket, each with that bucket's own token.
    expect(r2.makeClient.mock.calls.map(([, b]) => b.accessKeyId)).toEqual(["id-kairos-snapshots"]);
  });

  it("answers null for a missing object and rethrows anything else", async () => {
    const r2 = fakeR2();
    expect(await r2.storage.get("renders/u1/nope.pdf")).toBeNull();
    const broken = createStorage(config, () => ({ send: async () => Promise.reject(new Error("socket hang up")) }) as unknown as S3Client);
    await expect(broken.get("renders/u1/x.pdf")).rejects.toThrow(/socket hang up/);
  });

  it("refuses a malformed key before any request", async () => {
    const r2 = fakeR2();
    await expect(r2.storage.put("uploads/u1/../x", "x", "text/plain")).rejects.toThrow(/invalid storage key/);
    await expect(r2.storage.get("uploads/u1/sub/x.pdf")).rejects.toThrow(/invalid storage key/);
    expect(r2.calls).toEqual([]);
  });

  it("answers 503 storage_unavailable for a bucket without a token, and with no endpoint at all", async () => {
    const partial = createStorage({ endpoint: config.endpoint, buckets: { uploads: bucket("kairos-uploads") } }, fakeR2().makeClient);
    const off = createStorage({ buckets: {} }, fakeR2().makeClient);
    for (const call of [() => partial.get("snapshots/u1/x.pdf"), () => off.put("uploads/u1/x.pdf", "x", "text/plain"), () => off.presignGet("renders/u1/x.pdf")]) {
      const err = await call().then(() => undefined, (e: unknown) => e);
      expect(err).toBeInstanceOf(HttpError);
      expect(err).toMatchObject({ status: 503, code: "storage_unavailable" });
    }
  });
});

describe("presignGet", () => {
  // The real S3 client signs locally: no request leaves the process.
  const real = createStorage(config);

  it("signs a GET for the snapshot key with the snapshots token, expiring in 5 minutes by default", async () => {
    const url = new URL(await real.presignGet("snapshots/u1/abc.pdf"));
    expect(url.origin).toBe("https://acct.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/kairos-snapshots/u1/abc.pdf");
    expect(url.searchParams.get("X-Amz-Expires")).toBe(String(PRESIGN_MAX_SEC));
    expect(PRESIGN_MAX_SEC).toBeLessThanOrEqual(300);
    expect(url.searchParams.get("X-Amz-Credential")).toMatch(/^id-kairos-snapshots\//);
  });

  it("takes a shorter lifetime but never a longer one", async () => {
    expect(new URL(await real.presignGet("renders/u1/abc.pdf", 60)).searchParams.get("X-Amz-Expires")).toBe("60");
    await expect(real.presignGet("renders/u1/abc.pdf", 301)).rejects.toThrow(/at most 300/);
    await expect(real.presignGet("renders/u1/abc.pdf", 0)).rejects.toThrow(/at most 300/);
  });

  it("signs rendered PDFs only: never an upload or a backup", async () => {
    await expect(real.presignGet("uploads/u1/resume.docx")).rejects.toThrow(/renders and snapshots only/);
    await expect(real.presignGet("backups/journal/x.age")).rejects.toThrow(/renders and snapshots only/);
  });
});

describe("deleteUserObjects (erasure)", () => {
  it("empties the user's prefix in every user bucket and leaves other users and backups alone", async () => {
    const r2 = fakeR2();
    for (const b of ["uploads", "renders", "snapshots"] as const) {
      await r2.storage.put(userKey(b, "u1", "a.pdf"), "a", "application/pdf");
      await r2.storage.put(userKey(b, "u1", "b.pdf"), "b", "application/pdf");
      // A user id that extends u1's: the prefix ends in "/" so it is not swept along.
      await r2.storage.put(userKey(b, "u12", "a.pdf"), "a", "application/pdf");
    }
    await r2.storage.put("backups/journal/x.age", "j", "application/octet-stream");
    expect(await r2.storage.deleteUserObjects("u1")).toBe(6);
    expect([...r2.objects.keys()].sort()).toEqual(["kairos-backups|journal/x.age", "kairos-renders|u12/a.pdf", "kairos-snapshots|u12/a.pdf", "kairos-uploads|u12/a.pdf"]);
  });

  it("pages past R2's list limit", async () => {
    const r2 = fakeR2(2);
    for (let i = 0; i < 5; i++) await r2.storage.put(userKey("renders", "u1", `${i}.pdf`), "x", "application/pdf");
    // Uploads and snapshots are empty but must still be configured: erasure refuses to skip a bucket it cannot see.
    expect(await r2.storage.deleteUserObjects("u1")).toBe(5);
    expect(r2.objects.size).toBe(0);
  });

  it("fails loudly when R2 refuses a delete or a user bucket has no token, so erasure is never marked done", async () => {
    const refusing = createStorage(config, () =>
      ({
        send: async (cmd: unknown) =>
          cmd instanceof ListObjectsV2Command ? { Contents: [{ Key: "u1/a.pdf" }] } : { Errors: [{ Key: "u1/a.pdf", Code: "AccessDenied" }] },
      }) as unknown as S3Client,
    );
    await expect(refusing.deleteUserObjects("u1")).rejects.toThrow(/refused 1 of 1 deletes in uploads/);
    const noSnapshots = createStorage({ endpoint: config.endpoint, buckets: { uploads: bucket("u"), renders: bucket("r") } }, fakeR2().makeClient);
    await expect(noSnapshots.deleteUserObjects("u1")).rejects.toMatchObject({ code: "storage_unavailable" });
    await expect(fakeR2().storage.deleteUserObjects("../u1")).rejects.toThrow(/unsafe user id/);
  });
});

describe("storageConfig", () => {
  it("turns on only the buckets whose name and token are all set", () => {
    const e = parseEnv({
      DATABASE_URL: "postgres://u:p@localhost:5432/db",
      REDIS_URL: "redis://localhost:6379",
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
      WEB_ORIGIN: "http://localhost:3000",
      INBOUND_WEBHOOK_SECRET: "y".repeat(16),
      R2_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
      R2_BUCKET_RENDERS: "kairos-renders-staging",
      R2_RENDERS_ACCESS_KEY_ID: "rid",
      R2_RENDERS_SECRET_ACCESS_KEY: "rsecret",
    });
    expect(storageConfig(e)).toEqual({
      endpoint: "https://acct.r2.cloudflarestorage.com",
      buckets: { renders: { name: "kairos-renders-staging", accessKeyId: "rid", secretAccessKey: "rsecret" } },
    });
  });
});
