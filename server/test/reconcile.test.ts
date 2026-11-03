import { describe, expect, it } from "vitest";
import { redriveAction } from "../src/jobs/queues";

// What a reconciler does with a job id Redis may have lost (WP-09). A finished job is replaced only where a rerun is
// harmless and free (the cloud claim and classify are conditional and model-free); tailoring costs a model call.
describe("redriveAction", () => {
  it("adds a job Redis no longer has", () => {
    expect(redriveAction("unknown", false)).toBe("add");
    expect(redriveAction("unknown", true)).toBe("add");
  });

  it("leaves a waiting, delayed or running job alone", () => {
    for (const state of ["waiting", "delayed", "active", "prioritized", "waiting-children"]) {
      expect(redriveAction(state, true), state).toBe("skip");
    }
  });

  it("replaces a finished job only when asked", () => {
    expect(redriveAction("failed", true)).toBe("replace");
    expect(redriveAction("completed", true)).toBe("replace");
    expect(redriveAction("failed", false)).toBe("skip");
    expect(redriveAction("completed", false)).toBe("skip");
  });
});
