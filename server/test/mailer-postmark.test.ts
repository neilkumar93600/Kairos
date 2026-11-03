import { createHash } from "node:crypto";
import { Errors, ServerClient } from "postmark";
import { afterEach, describe, expect, it, vi } from "vitest";

// Before env() is first read: two Postmark tokens, no sink. No request leaves the process: every call is stubbed.
process.env.POSTMARK_SERVER_TOKEN = "pm-transactional";
process.env.POSTMARK_BROADCAST_TOKEN = "pm-broadcast";
process.env.POSTMARK_BROADCAST_STREAM = "digests";
delete process.env.MAIL_SINK_FILE;
const { addressHash, findSent, mailErrorCode, metadataKey, sendEmail } = await import("../src/lib/mailer");

type Sent = { token: string; message: Parameters<ServerClient["sendEmail"]>[0] };
const tokenOf = (c: ServerClient) => (c as unknown as { token: string }).token;

describe("sendEmail through Postmark (messaging-44)", () => {
  afterEach(() => vi.restoreAllMocks());

  function capture() {
    const sent: Sent[] = [];
    vi.spyOn(ServerClient.prototype, "sendEmail").mockImplementation(async function (this: ServerClient, message) {
      sent.push({ token: tokenOf(this), message });
      return { MessageID: `mid-${sent.length}`, SubmittedAt: "", To: message.To, ErrorCode: 0, Message: "OK" };
    });
    return sent;
  }

  it("sends transactional mail on the outbound stream with its token, untracked, and returns the MessageID", async () => {
    const sent = capture();
    expect(await sendEmail({ to: "a@test.local", subject: "Code", text: "123456", metadata: { k: "resend_available:a1:1" } })).toEqual({ messageId: "mid-1" });
    expect(sent[0]).toMatchObject({
      token: "pm-transactional",
      message: { To: "a@test.local", MessageStream: "outbound", TrackOpens: false, TrackLinks: "None", Metadata: { k: "resend_available:a1:1" } },
    });
  });

  it("sends broadcast mail on the broadcast stream with the broadcast token", async () => {
    const sent = capture();
    await sendEmail({ to: "a@test.local", subject: "Digest", text: "3 new jobs", stream: "broadcast" });
    expect(sent[0]).toMatchObject({ token: "pm-broadcast", message: { MessageStream: "digests", TrackOpens: false, TrackLinks: "None" } });
  });

  it("gives every Postmark call a 10 second timeout", () => {
    const options = (c: ServerClient) => (c as unknown as { httpClient: { clientOptions: { timeout: number } } }).httpClient.clientOptions;
    const spy = vi.spyOn(ServerClient.prototype, "sendEmail").mockResolvedValue({ MessageID: "m", SubmittedAt: "", ErrorCode: 0, Message: "OK" });
    return sendEmail({ to: "a@test.local", subject: "s", text: "t" }).then(() => expect(options(spy.mock.contexts[0] as ServerClient).timeout).toBe(10));
  });

  it("finds an earlier send by its ledger key on the right stream", async () => {
    const k = metadataKey("digest:s1:2026-11-03");
    const search = vi.spyOn(ServerClient.prototype, "getOutboundMessages").mockResolvedValue({ TotalCount: 1, Messages: [{ MessageID: "mid-old", Metadata: { k } }] } as never);
    expect(await findSent(k, "broadcast")).toBe("mid-old");
    expect(search).toHaveBeenCalledWith({ count: 1, offset: 0, messageStream: "digests", metadata_k: k });
    search.mockResolvedValue({ TotalCount: 0, Messages: [] } as never);
    expect(await findSent(k, "broadcast")).toBeNull();
  });

  it("never trusts a search result that does not carry the key (a search that ignored the filter)", async () => {
    vi.spyOn(ServerClient.prototype, "getOutboundMessages").mockResolvedValue({ TotalCount: 9, Messages: [{ MessageID: "stranger", Metadata: { k: "other" } }] } as never);
    expect(await findSent(metadataKey("resend_available:a:1"), "transactional")).toBeNull();
  });

  it("metadata keys fit Postmark's 80-character limit and carry no id", () => {
    const longest = `autopilot_paused:${"u".repeat(64)}:${"9".repeat(20)}`;
    expect(metadataKey(longest)).toMatch(/^[0-9a-f]{32}$/);
    expect(metadataKey(longest).length).toBeLessThanOrEqual(80);
  });

  it("hashes addresses with a key, exact address only (case and spaces folded, nothing else)", () => {
    expect(addressHash(" A@Test.local ")).toEqual(addressHash("a@test.local"));
    expect(addressHash("a+x@test.local")).not.toEqual(addressHash("a@test.local"));
    expect(addressHash("a@test.local")).not.toEqual(createHash("sha256").update("a@test.local").digest());
  });

  it("classifies permanent refusals; a timeout, 429, 5xx or 401 stays retryable", () => {
    expect(mailErrorCode(new Errors.InactiveRecipientsError("inactive", 406, 422))).toBe("postmark_406");
    expect(mailErrorCode(new Errors.ApiInputError("bad address", 300, 422))).toBe("postmark_422");
    expect(mailErrorCode(new Errors.RateLimitExceededError("slow down", 0, 429))).toBeNull();
    expect(mailErrorCode(new Errors.InternalServerError("oops", 0, 500))).toBeNull();
    expect(mailErrorCode(new Errors.InvalidAPIKeyError("token", 10, 401))).toBeNull();
    expect(mailErrorCode(new Error("socket hang up"))).toBeNull();
  });
});
