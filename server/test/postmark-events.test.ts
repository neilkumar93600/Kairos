import request from "supertest";
import { describe, expect, it, vi } from "vitest";

// The token gate of Postmark's delivery-event webhook; no database is reached on a refusal.
process.env.POSTMARK_EVENTS_SECRET = "events-secret-0123456789";
const { createApp } = await import("../src/app");
const { db } = await import("../src/db/client");
const app = createApp({ auth: { handler: async () => new Response(null), getSession: async () => null }, corsOrigins: [], healthChecks: {} });
const complaint = { RecordType: "SpamComplaint", Email: "a@test.local" };

describe("POST /api/webhooks/postmark-events (WP-44)", () => {
  it.each(["", "?token=wrong", "?token=events-secret-012345678"])("refuses %s with 403 before reading the body", async (query) => {
    const insert = vi.spyOn(db(), "insert");
    const res = await request(app).post(`/api/webhooks/postmark-events${query}`).send(complaint);
    expect(res.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses a gzip body even with the right token (inflate is off)", async () => {
    const res = await request(app).post("/api/webhooks/postmark-events?token=events-secret-0123456789").set("content-encoding", "gzip").set("content-type", "application/json").send("x");
    expect(res.status).toBe(415);
  });

  it("answers 422 for a complaint it cannot read, so a dropped complaint shows up in Postmark's webhook log", async () => {
    const res = await request(app).post("/api/webhooks/postmark-events?token=events-secret-0123456789").send({ RecordType: "SpamComplaint" });
    expect(res.status).toBe(422);
  });

  it("acknowledges types it does not handle without reading them", async () => {
    const res = await request(app).post("/api/webhooks/postmark-events?token=events-secret-0123456789").send({ RecordType: "Open" });
    expect(res.body).toEqual({ recorded: false });
  });
});
