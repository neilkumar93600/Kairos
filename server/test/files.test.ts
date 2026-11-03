import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthGateway } from "../src/lib/auth";
import type { Storage } from "../src/lib/storage";
import { fakeBucket, fakeR2, r2Config } from "./helpers/fake-r2";

/**
 * GET /api/files/* (WP-14, CISO mustFix 8 storage half, mustFix 11): user B cannot fetch user A's object, and cannot
 * tell it apart from a missing one. The route's storage is an in-memory R2.
 */

const current = vi.hoisted(() => ({ storage: undefined as Storage | undefined }));
vi.mock("../src/lib/storage", async (orig) => ({ ...(await orig<typeof import("../src/lib/storage")>()), storage: () => current.storage! }));

const { createApp } = await import("../src/app");

/** "Bearer <id>" is signed in as <id>; no header is signed out. */
const byBearer: AuthGateway = {
  handler: async () => new Response(null, { status: 404 }),
  getSession: async (headers) => {
    const id = headers.get("authorization")?.replace(/^Bearer /, "");
    return id ? { sessionId: "s", createdAt: new Date(), user: { id, email: `${id}@test.local`, name: "U", emailVerified: true } } : null;
  },
};
const app = createApp({ auth: byBearer, corsOrigins: [], healthChecks: {} });
const as = (userId: string, path: string) => request(app).get(path).set("authorization", `Bearer ${userId}`).set("x-request-id", "req-files-1");

let r2: ReturnType<typeof fakeR2>;
beforeEach(async () => {
  r2 = fakeR2();
  current.storage = r2.storage;
  await r2.storage.put("snapshots/userA/3f9a.pdf", "%PDF-1.7 A's resume", "application/pdf");
  await r2.storage.put("uploads/userA/import.docx", "PK docx", "application/octet-stream");
  await r2.storage.put("uploads/userA/note.html", "<script>alert(1)</script>", "text/html");
});

/** The body of a 404 for one of B's own keys that does not exist: every refusal below must equal it. */
const missing = async () => (await as("userB", "/api/files/snapshots/userB/3f9a.pdf")).body;

describe("GET /api/files/<bucket>/<userId>/<name>", () => {
  it("streams the caller's own file as a no-store attachment that cannot render on our origin", async () => {
    const res = await as("userA", "/api/files/snapshots/userA/3f9a.pdf").buffer(true);
    expect(res.status).toBe(200);
    expect(res.body.toString()).toBe("%PDF-1.7 A's resume");
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-length"]).toBe(String(Buffer.byteLength("%PDF-1.7 A's resume")));
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["content-disposition"]).toBe('attachment; filename="3f9a.pdf"');
    expect(res.headers["content-security-policy"]).toBe("default-src 'none'; sandbox");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("names DOCX by its extension and anything else as bytes, never as HTML", async () => {
    expect((await as("userA", "/api/files/uploads/userA/import.docx")).headers["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const html = await as("userA", "/api/files/uploads/userA/note.html");
    expect(html.headers["content-type"]).toBe("application/octet-stream");
    expect(html.headers["content-disposition"]).toMatch(/^attachment;/);
  });

  it("answers user B's request for user A's file with the same 404 as a missing file, without asking R2", async () => {
    const expected = await missing();
    expect(expected).toEqual({ error: { code: "not_found", message: "File not found", requestId: "req-files-1" } });
    const calls = r2.calls.length;
    const res = await as("userB", "/api/files/snapshots/userA/3f9a.pdf");
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expected);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(r2.calls.length).toBe(calls);
  });

  it.each([
    ["a traversal into A's prefix", "/api/files/uploads/userB/..%2F..%2Fuploads%2FuserA%2Fimport.docx"],
    ["an encoded slash", "/api/files/uploads%2FuserA%2Fimport.docx"],
    ["a nested path", "/api/files/uploads/userB/sub/x.pdf"],
    ["a bucket and user only", "/api/files/uploads/userB"],
    ["an unknown bucket", "/api/files/failures/userB/x.png"],
    ["a dot-dot name", "/api/files/uploads/userB/..pdf"],
  ])("answers %s with that same 404", async (_label, path) => {
    const expected = await missing();
    const res = await as("userB", path);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expected);
  });

  it("never serves backups, even to a user whose id matches the folder", async () => {
    await r2.storage.put("backups/journal/x.age", "journal", "application/octet-stream");
    const res = await as("journal", "/api/files/backups/journal/x.age");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("asks for a session", async () => {
    const res = await request(app).get("/api/files/snapshots/userA/3f9a.pdf");
    expect(res.status).toBe(401);
    expect(r2.calls.filter((c) => c.command === "GetObjectCommand")).toEqual([]);
  });

  it("answers 503 storage_unavailable for the caller's own key when this process has no token, and still 404 for others", async () => {
    current.storage = fakeR2({ endpoint: r2Config.endpoint, buckets: { uploads: fakeBucket("kairos-uploads") } }).storage;
    const own = await as("userA", "/api/files/snapshots/userA/3f9a.pdf");
    expect(own.status).toBe(503);
    expect(own.body.error.code).toBe("storage_unavailable");
    expect((await as("userB", "/api/files/snapshots/userA/3f9a.pdf")).status).toBe(404);
  });

  it("counts against the signed-in user's limit class", async () => {
    const res = await as("userA", "/api/files/snapshots/userA/3f9a.pdf");
    expect(res.headers["ratelimit-policy"]).toContain('"user_api"');
  });
});
