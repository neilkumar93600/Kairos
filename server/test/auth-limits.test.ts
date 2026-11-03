import { beforeEach, describe, expect, it, vi } from "vitest";

// hit() is the shared Postgres counter; here it is an in-memory stand-in, so the per-email rules run without a database.
const counts = new Map<string, number>();
vi.mock("../src/middleware/rate-limit", async (original) => ({
  ...(await original<object>()),
  hit: vi.fn(async (key: string) => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return { count: counts.get(key)!, resetAt: new Date(Date.now() + 60_000) };
  }),
}));

const { auth, limitByEmail } = await import("../src/lib/auth");

beforeEach(() => counts.clear());

describe("Better Auth rate-limit options", () => {
  it("keys on the resolved client IP, stores counts in the database, and caps sign-ups per IP per day", () => {
    const { rateLimit, advanced, hooks } = auth().options;
    expect(advanced?.ipAddress?.ipAddressHeaders).toEqual(["x-kairos-client-ip"]);
    expect(rateLimit).toMatchObject({ enabled: true, storage: "database", window: 60, max: 60 });
    expect(rateLimit?.customRules).toMatchObject({
      "/sign-in/email": { window: 60, max: 20 },
      "/sign-up/email": { window: 86_400, max: 3 },
      "/email-otp/send-verification-otp": { window: 3_600, max: 10 },
    });
    expect(hooks?.before).toBeTypeOf("function");
  });
});

describe("limitByEmail", () => {
  const signIn = (email: string) => limitByEmail("/sign-in/email", { email, password: "x" });

  it("allows 5 password sign-ins a minute per address, whatever the case or +tag, then refuses with 429", async () => {
    for (const email of ["a@x.io", "A@x.io", " a+1@x.io", "a+2@X.io", "a@x.io"]) await signIn(email);
    await expect(signIn("a@x.io")).rejects.toMatchObject({ statusCode: 429 });
    await expect(signIn("b@x.io")).resolves.toBeUndefined();
  });

  it("stores only a hash of the address", async () => {
    await signIn("someone@example.com");
    expect([...counts.keys()].join()).not.toMatch(/someone|example/);
  });

  it("shares one bucket across every path that mails a code: 3 per 10 minutes", async () => {
    await limitByEmail("/email-otp/send-verification-otp", { email: "c@x.io", type: "sign-in" });
    await limitByEmail("/email-otp/request-password-reset", { email: "c@x.io" });
    await limitByEmail("/forget-password/email-otp", { email: "c@x.io" });
    await expect(limitByEmail("/send-verification-email", { email: "c@x.io" })).rejects.toMatchObject({ statusCode: 429 });
  });

  it("ignores other paths and bodies without an email", async () => {
    await limitByEmail("/get-session", { email: "d@x.io" });
    await limitByEmail("/sign-in/email", undefined);
    expect(counts.size).toBe(0);
  });
});
