import { describe, expect, it } from "vitest";
import { factPatchSchema } from "../src/routes/profile";

describe("PATCH /api/profile/facts/:id body", () => {
  it("an edit without confirmed leaves it out", () => {
    expect(factPatchSchema.parse({ text: "edited text" })).not.toHaveProperty("confirmed");
  });

  it("confirmed false is kept", () => {
    expect(factPatchSchema.parse({ confirmed: false })).toEqual({ confirmed: false });
  });
});
