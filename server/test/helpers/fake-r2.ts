import { Readable } from "node:stream";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { vi } from "vitest";
import { createStorage, type BucketConfig, type StorageConfig } from "../../src/lib/storage";

export const fakeBucket = (name: string): BucketConfig => ({ name, accessKeyId: `id-${name}`, secretAccessKey: `secret-${name}` });

/** Every bucket configured, each with its own token. */
export const r2Config: StorageConfig = {
  endpoint: "https://acct.r2.cloudflarestorage.com",
  buckets: { uploads: fakeBucket("kairos-uploads"), renders: fakeBucket("kairos-renders"), snapshots: fakeBucket("kairos-snapshots"), backups: fakeBucket("kairos-backups"), tombstones: fakeBucket("kairos-tombstones") },
};

/**
 * An in-memory R2 behind S3Client#send, so unit tests never open a socket. Each client is bound to its bucket's token
 * (another bucket is AccessDenied) and lists at most `pageSize` keys, like R2's 1,000. `calls` records every request.
 */
export function fakeR2(config: StorageConfig = r2Config, pageSize = 1000) {
  const objects = new Map<string, string>(); // "<bucket name>|<object key>"
  const calls: { bucket: string; command: string; key?: string; accessKeyId: string }[] = [];
  const makeClient = vi.fn((_endpoint: string, b: BucketConfig) => {
    const send = async (cmd: { input: Record<string, unknown> }) => {
      const input = cmd.input as {
        Bucket: string; Key?: string; Prefix?: string; Body?: string; Delete?: { Objects: { Key: string }[] }; Delimiter?: string; ContinuationToken?: string;
      };
      if (input.Bucket !== b.name) throw Object.assign(new Error("Access Denied"), { name: "AccessDenied" });
      calls.push({ bucket: input.Bucket, command: cmd.constructor.name, key: input.Key, accessKeyId: b.accessKeyId });
      const id = `${input.Bucket}|${input.Key}`;
      if (cmd instanceof PutObjectCommand) return void objects.set(id, String(input.Body));
      if (cmd instanceof GetObjectCommand) {
        if (!objects.has(id)) throw Object.assign(new Error("The specified key does not exist."), { name: "NoSuchKey" });
        const body = objects.get(id)!;
        return { Body: Readable.from([Buffer.from(body)]), ContentLength: Buffer.byteLength(body) };
      }
      if (cmd instanceof ListObjectsV2Command) {
        let keys = [...objects.keys()].filter((k) => k.startsWith(`${input.Bucket}|${input.Prefix ?? ""}`)).map((k) => k.split("|")[1]!).sort();
        // A delimiter groups keys by their first segment, as R2 returns CommonPrefixes.
        if (input.Delimiter) keys = [...new Set(keys.map((k) => `${k.split(input.Delimiter!)[0]}${input.Delimiter}`))];
        const start = Number(input.ContinuationToken ?? 0);
        const page = keys.slice(start, start + pageSize);
        const more = keys.length > start + pageSize;
        return {
          ...(input.Delimiter ? { CommonPrefixes: page.map((Prefix) => ({ Prefix })) } : { Contents: page.map((Key) => ({ Key })) }),
          IsTruncated: more,
          NextContinuationToken: more ? String(start + pageSize) : undefined,
        };
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
