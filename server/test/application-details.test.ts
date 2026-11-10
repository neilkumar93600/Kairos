import { describe, expect, it } from "vitest";
import { decrypt, encrypt, parseKeks } from "../src/lib/crypto";
import { detailsAad, mergeDetails, readDetails, readDetailsForWrite } from "../src/services/application-details";

const keys = parseKeks(`v1:${Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 7 + 3) % 256)).toString("base64")}`);
const patch = { noticePeriod: "1_month" as const, openToRelocation: null, expectedSalary: null };

describe("application details (services/application-details.ts)", () => {
  it("keeps unrelated stored keys", () => {
    expect(mergeDetails({ eeo: "x", noticePeriod: "immediate" }, patch)).toEqual({ eeo: "x", noticePeriod: "1_month", openToRelocation: null, expectedSalary: null });
  });

  it("starts from nothing", () => {
    expect(mergeDetails(null, patch)).toEqual({ noticePeriod: "1_month", openToRelocation: null, expectedSalary: null });
  });

  it("round-trips through encrypt and decrypt, bound to the user's row", () => {
    const env = encrypt(JSON.stringify(mergeDetails(null, patch)), detailsAad("u1"), keys);
    expect(env.toString("utf8")).not.toContain("1_month");
    expect(JSON.parse(decrypt(env, detailsAad("u1"), keys).toString("utf8"))).toEqual(patch);
    expect(() => decrypt(env, detailsAad("u2"), keys)).toThrow();
  });

  it("an unreadable envelope reads as nothing, without throwing", () => {
    const foreign = encrypt("{}", detailsAad("other"), keys);
    expect(readDetails(foreign, "u1", keys)).toBeNull();
    expect(readDetails(Buffer.from("garbage"), "u1", keys)).toBeNull();
    expect(readDetails(null, "u1", keys)).toBeNull();
  });

  it("a write over an unreadable envelope is refused with 409, a missing one starts empty", () => {
    const foreign = encrypt("{}", detailsAad("other"), keys);
    for (const bad of [foreign, Buffer.from("garbage")]) {
      expect(() => readDetailsForWrite(bad, "u1", keys)).toThrowError(expect.objectContaining({ status: 409, code: "details_unreadable" }));
    }
    expect(readDetailsForWrite(null, "u1", keys)).toBeNull();
    expect(readDetailsForWrite(encrypt('{"gender":"F"}', detailsAad("u1"), keys), "u1", keys)).toEqual({ gender: "F" });
  });
});
