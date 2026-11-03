import type { Readable } from "node:stream";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, type Env } from "./env";
import { HttpError } from "./errors";

/**
 * Object storage on Cloudflare R2 (WP-14, 06-infrastructure 4.3). Four private buckets, each reached with its own
 * token, so a leaked key opens one bucket. Every key is `<bucket>/<owner>/<name>`: the first segment picks the bucket
 * and, in the user buckets, the second is the user id. A stored key alone therefore says where an object lives and
 * whose it is. Inside its bucket the object drops the first segment (kairos-snapshots holds `<userId>/<hash>.pdf`).
 */
export const BUCKETS = ["uploads", "renders", "snapshots", "backups"] as const;
export type Bucket = (typeof BUCKETS)[number];
/** Keyed by user id: the buckets the download route serves and erasure empties. Backups hold no per-user prefix. */
export const USER_BUCKETS = ["uploads", "renders", "snapshots"] as const satisfies readonly Bucket[];
export type UserBucket = (typeof USER_BUCKETS)[number];

/** Presigned GETs live at most 5 minutes (WP-14 acceptance). */
export const PRESIGN_MAX_SEC = 300;
/** The applier may fetch rendered PDFs, nothing else (06-infrastructure 4.3). */
const PRESIGNABLE: readonly Bucket[] = ["renders", "snapshots"];

// Better Auth ids and uuids; then one file name of safe ASCII. 9 + 64 + 120 + 2 stays under resume_file_key's 200.
const OWNER = /^[A-Za-z0-9_-]{1,64}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

export interface ParsedKey {
  bucket: Bucket;
  owner: string;
  name: string;
}

/** Splits a key, or null unless it is exactly `<bucket>/<owner>/<name>` with safe segments: no `..`, no empty part. */
export function parseKey(key: string): ParsedKey | null {
  const parts = key.split("/");
  if (parts.length !== 3) return null;
  const [bucket, owner, name] = parts as [string, string, string];
  if (!(BUCKETS as readonly string[]).includes(bucket) || !OWNER.test(owner) || !NAME.test(name) || name.includes("..")) return null;
  return { bucket: bucket as Bucket, owner, name };
}

/** The key of a user's object. Throws on an unsafe id or name, so no caller can build a key outside the user's prefix. */
export function userKey(bucket: UserBucket, userId: string, name: string): string {
  const key = `${bucket}/${userId}/${name}`;
  if (!parseKey(key)) throw new Error(`unsafe storage key for bucket ${bucket}`);
  return key;
}

export interface BucketConfig {
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface StorageConfig {
  endpoint?: string;
  buckets: Partial<Record<Bucket, BucketConfig>>;
}

/** The buckets this process holds a token for (env.ts refuses half-set ones at boot). */
export function storageConfig(e: Env): StorageConfig {
  const buckets: StorageConfig["buckets"] = {};
  for (const bucket of BUCKETS) {
    const up = bucket.toUpperCase() as Uppercase<Bucket>;
    const [name, accessKeyId, secretAccessKey] = [e[`R2_BUCKET_${up}`], e[`R2_${up}_ACCESS_KEY_ID`], e[`R2_${up}_SECRET_ACCESS_KEY`]];
    if (name && accessKeyId && secretAccessKey) buckets[bucket] = { name, accessKeyId, secretAccessKey };
  }
  return { endpoint: e.R2_ENDPOINT, buckets };
}

function r2Client(endpoint: string, bucket: BucketConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: bucket.accessKeyId, secretAccessKey: bucket.secretAccessKey },
    // R2 takes both styles; path style also works against a local MinIO (06-infrastructure, dev stand-in).
    forcePathStyle: true,
    // Checksums only where an operation requires one, as Cloudflare advises for SDK releases that add them by default.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    requestHandler: { connectionTimeout: 5_000, requestTimeout: 30_000 },
  });
}

export interface StoredFile {
  body: Readable;
  contentLength?: number;
}

export function createStorage(config: StorageConfig, makeClient: (endpoint: string, bucket: BucketConfig) => S3Client = r2Client) {
  const clients = new Map<Bucket, S3Client>();

  /** The bucket's own client and name; 503 when this process holds no token for it. */
  function open(bucket: Bucket) {
    const b = config.buckets[bucket];
    if (!b || !config.endpoint) throw new HttpError(503, "storage_unavailable", `File storage (${bucket}) is not configured`);
    let client = clients.get(bucket);
    if (!client) clients.set(bucket, (client = makeClient(config.endpoint, b)));
    return { client, Bucket: b.name };
  }

  function locate(key: string) {
    const parsed = parseKey(key);
    if (!parsed) throw new Error("invalid storage key");
    return { ...open(parsed.bucket), Key: `${parsed.owner}/${parsed.name}`, bucket: parsed.bucket };
  }

  return {
    /**
     * Writes one object. The caller validated the bytes (magic bytes and size for uploads, WP-17) and builds the key with
     * userKey. A stream needs its length (a backup dump, WP-13). ponytail: one PUT, so at most 5 GiB per object on R2;
     * the backup manifest warns from 4 GiB, and a multipart upload replaces this when a dump nears it.
     */
    async put(key: string, body: Uint8Array | string | Readable, contentType: string, contentLength?: number): Promise<void> {
      const { client, Bucket, Key } = locate(key);
      await client.send(new PutObjectCommand({ Bucket, Key, Body: body, ContentType: contentType, ContentLength: contentLength }));
    },

    /** Streams one object, or null when it does not exist. */
    async get(key: string): Promise<StoredFile | null> {
      const { client, Bucket, Key } = locate(key);
      try {
        const out = await client.send(new GetObjectCommand({ Bucket, Key }));
        return { body: out.Body as Readable, contentLength: out.ContentLength };
      } catch (err) {
        if ((err as { name?: string }).name === "NoSuchKey") return null;
        throw err;
      }
    },

    /**
     * A GET URL for the cloud applier, which holds no storage token (APPLIER_FORBIDDEN). Rendered PDFs only, at most
     * 5 minutes: mint it at the last hop before the applier, never for a browser. Signed locally, no request to R2.
     */
    async presignGet(key: string, expiresInSec = PRESIGN_MAX_SEC): Promise<string> {
      const { client, Bucket, Key, bucket } = locate(key);
      if (!PRESIGNABLE.includes(bucket)) throw new Error("presigned URLs are for renders and snapshots only");
      if (!(expiresInSec >= 1 && expiresInSec <= PRESIGN_MAX_SEC)) throw new Error(`presigned URLs live at most ${PRESIGN_MAX_SEC} s`);
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key }), { expiresIn: expiresInSec });
    },

    /**
     * Erasure: deletes everything under the user's prefix in every user bucket and returns the count. Throws when a
     * user bucket has no token or R2 refuses a delete, so the caller never records the erasure as done.
     */
    async deleteUserObjects(userId: string): Promise<number> {
      if (!OWNER.test(userId)) throw new Error("unsafe user id");
      let deleted = 0;
      for (const bucket of USER_BUCKETS) {
        const { client, Bucket } = open(bucket);
        // Each pass lists the first page again: what was listed is gone, so no continuation token is needed.
        for (;;) {
          const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix: `${userId}/`, MaxKeys: 1000 }));
          const objects = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
          if (objects.length === 0) break;
          const out = await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: objects, Quiet: true } }));
          if (out.Errors?.length) throw new Error(`R2 refused ${out.Errors.length} of ${objects.length} deletes in ${bucket}`);
          deleted += objects.length;
        }
      }
      return deleted;
    },
  };
}

export type Storage = ReturnType<typeof createStorage>;

let shared: Storage | undefined;

/** This process's storage, from env(): the api and the worker. The applier has no R2 token and throws here. */
export function storage(): Storage {
  return (shared ??= createStorage(storageConfig(env())));
}
