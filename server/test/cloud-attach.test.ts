import { randomUUID } from "node:crypto";
import { chromium } from "playwright-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fillInBrowser, type FillInput } from "../src/jobs/cloud-apply";
import { fakeBrowser } from "./helpers/fake-browser";

/**
 * The attach step of fillInBrowser against the fake page (WP-19 round 1, S1 and P2): every branch ends before the `filling`
 * mark unless it goes on to fill, so a failure here is "nothing was sent" (the WP-29 rule). The log records the order.
 */
const PDF = { name: "Avery Stone - Resume.pdf", buffer: Buffer.from("%PDF-1.7") };
const SUBMITTED = { outcome: "submitted", filledFields: [{ fieldKey: "first_name", label: "x", value: "y" }] };

async function run(extra: Partial<FillInput>, page: Parameters<typeof fakeBrowser>[0]) {
  const log: unknown[] = page?.resumeInput?.uploads ?? [];
  const fill = fakeBrowser({ fill: async () => (log.push("fill"), SUBMITTED), ...page });
  const outcome = await fillInBrowser(await chromium.launch(), {
    applicationId: randomUUID(),
    applyUrl: "https://job-boards.greenhouse.io/x/jobs/1",
    answers: [],
    resumeLines: [],
    coverLetter: null,
    fillerSource: "",
    onPhase: async (p) => void log.push(p),
    ...extra,
  });
  return { outcome, log, fill };
}

describe("the resume attach", () => {
  afterEach(() => vi.restoreAllMocks());

  it("attaches before the filling mark, and the report lists the resume", async () => {
    const uploads: unknown[] = [];
    const { outcome, log } = await run({ resumePdf: PDF }, { resumeInput: { uploads } });
    expect(log.map((e) => (typeof e === "string" ? e : "attach"))).toEqual(["navigating", "attach", "filling", "fill"]);
    expect(outcome).toMatchObject({ submitted: true });
    if (outcome.submitted) expect(outcome.report.filledFields.map((f) => f.fieldKey)).toContain("resume");
  });

  it("an attach that throws is attach_failed, before filling", async () => {
    const { outcome, log } = await run({ resumePdf: PDF }, { resumeInput: { uploads: [], fails: true } });
    expect(outcome).toEqual({ submitted: false, code: "applier_error", detail: "attach_failed" });
    expect(log).toEqual(["navigating"]);
  });

  it("a failed render with an optional resume input stops before filling, with the render's reason", async () => {
    const { outcome, log } = await run({ renderFailure: "render_mismatch" }, { resumeInput: { uploads: [], required: false } });
    expect(outcome).toEqual({ submitted: false, code: "render_failed", detail: "render_mismatch" });
    expect(log).toEqual(["navigating"]);
  });

  it("a failed render on a page with no resume input still sends, without a file, as before WP-19", async () => {
    const { outcome, log } = await run({ renderFailure: "render_wait_timeout" }, {});
    expect(outcome).toMatchObject({ submitted: true });
    expect(log).toEqual(["navigating", "filling", "fill"]);
  });

  it("no document: a required input is resume_missing, an optional one sends without a file", async () => {
    expect((await run({}, { resumeInput: { uploads: [], required: true } })).outcome).toEqual({ submitted: false, code: "applier_error", detail: "resume_missing" });
    vi.restoreAllMocks();
    expect((await run({}, { resumeInput: { uploads: [], required: false } })).outcome).toMatchObject({ submitted: true });
  });
});
