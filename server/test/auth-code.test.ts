import { Errors } from "postmark";
import { describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
vi.mock("../src/lib/mailer", async (orig) => ({ ...(await orig<typeof import("../src/lib/mailer")>()), sendEmail }));
const { sendCode } = await import("../src/lib/auth");

describe("sendCode (sign-in codes, WP-44)", () => {
  it("sends on the transactional stream, never queued", async () => {
    sendEmail.mockResolvedValueOnce({ messageId: "m" });
    await sendCode("a@test.local", "Code", "123456", "otp-sign-in");
    expect(sendEmail).toHaveBeenCalledWith({ to: "a@test.local", subject: "Code", text: "123456", tag: "otp-sign-in" });
  });

  it("answers 422 email_undeliverable when Postmark holds the address inactive; other errors pass through", async () => {
    sendEmail.mockRejectedValueOnce(new Errors.InactiveRecipientsError("inactive", 406, 422));
    await expect(sendCode("a@test.local", "Code", "1", "t")).rejects.toMatchObject({ statusCode: 422, body: { code: "email_undeliverable" } });
    sendEmail.mockRejectedValueOnce(new Errors.InternalServerError("oops", 0, 500));
    await expect(sendCode("a@test.local", "Code", "1", "t")).rejects.toThrow("oops");
  });
});
