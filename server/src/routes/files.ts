import { Router } from "express";
import { pipeline } from "node:stream/promises";
import { notFound } from "../lib/errors";
import { logger } from "../lib/logger";
import { parseKey, storage, USER_BUCKETS } from "../lib/storage";
import { currentUser } from "../middleware/require-auth";

/** Types the route names; anything else leaves as bytes. The extension comes from our own writer, never a header. */
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
};

/**
 * GET /api/files/<bucket>/<userId>/<name>: streams one of the caller's own objects (WP-14, CISO mustFix 8). Another
 * user's key, a backup, a malformed key and a missing object all answer the same 404, so the route says nothing about
 * what exists. Files leave as no-store attachments under a sandbox CSP: an upload never renders on our origin.
 */
export const filesRouter = Router();

filesRouter.use((_req, res, next) => {
  res.set("cache-control", "no-store");
  next();
});

filesRouter.get("/*key", async (req, res) => {
  const me = currentUser(req);
  // Express 5 hands a wildcard over as decoded segments; an encoded "/" inside one makes the key fail to parse.
  const key = (req.params.key as unknown as string[]).join("/");
  const parsed = parseKey(key);
  if (!parsed || parsed.owner !== me.id || !(USER_BUCKETS as readonly string[]).includes(parsed.bucket)) throw notFound("File");
  const file = await storage().get(key);
  if (!file) throw notFound("File");

  res.set({
    "content-type": TYPES[parsed.name.slice(parsed.name.lastIndexOf(".") + 1).toLowerCase()] ?? "application/octet-stream",
    // parseKey allows only [A-Za-z0-9._-] in the name, so it needs no escaping here.
    "content-disposition": `attachment; filename="${parsed.name}"`,
    "content-security-policy": "default-src 'none'; sandbox",
  });
  if (file.contentLength !== undefined) res.set("content-length", String(file.contentLength));
  // Headers are out by now, so a failure mid-stream can only cut the connection.
  await pipeline(file.body, res).catch((err: unknown) => {
    logger.warn({ err }, "file download ended early");
    res.destroy();
  });
});
