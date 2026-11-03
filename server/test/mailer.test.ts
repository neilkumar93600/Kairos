import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Before env() is first read: point the dev mail sink at a temp file.
const dir = mkdtempSync(join(tmpdir(), "kairos-mail-"));
const sink = join(dir, "mail.jsonl");
process.env.MAIL_SINK_FILE = sink;

const { sendEmail } = await import("../src/lib/mailer");

describe("sendEmail with MAIL_SINK_FILE", () => {
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("appends each email as one JSON line instead of sending it", async () => {
    await sendEmail({ to: "a@test.local", subject: "Code", text: "Your code is 123456.", tag: "otp-sign-in" });
    await sendEmail({ to: "b@test.local", subject: "Code", text: "Your code is 654321." });
    const lines = readFileSync(sink, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ to: "a@test.local", subject: "Code", text: "Your code is 123456.", tag: "otp-sign-in" });
    expect(lines[1].to).toBe("b@test.local");
  });
});
