import { describe, expect, it, vi } from "vitest";

const enqueue = vi.fn(async () => undefined);
vi.mock("../src/jobs/queues", async (orig) => ({ ...(await orig<typeof import("../src/jobs/queues")>()), enqueue }));
const { BROADCAST_PRIORITY, enqueueNotify, notifyJobId } = await import("../src/jobs/notify");
const { QUEUE_CONFIG } = await import("../src/jobs/queues");

describe("notify queue (WP-44)", () => {
  it("puts broadcast kinds behind every transactional email: BullMQ runs unprioritised jobs first", async () => {
    await enqueueNotify("digest", "s1:2026-11-03", "u1");
    await enqueueNotify("resend_available", "a1:2", "u1");
    expect(enqueue).toHaveBeenNthCalledWith(1, "notify", { kind: "digest", entityId: "s1:2026-11-03", userId: "u1" }, "notify-digest-s1.2026-11-03", undefined, BROADCAST_PRIORITY);
    expect(enqueue).toHaveBeenNthCalledWith(2, "notify", { kind: "resend_available", entityId: "a1:2", userId: "u1" }, "notify-resend_available-a1.2", undefined, undefined);
  });

  it("job ids carry no ':' (BullMQ refuses them) and stay one per email", () => {
    expect(notifyJobId("forwarding_code", "u1:gmail:1700000000")).toBe("notify-forwarding_code-u1.gmail.1700000000");
  });

  it("retries a send as often as the ledger allows, with a lock longer than a send and a search", () => {
    expect(QUEUE_CONFIG.notify).toMatchObject({ attempts: 5 });
    expect(QUEUE_CONFIG.notify.lockDurationMs).toBeGreaterThan(20_000);
  });
});
